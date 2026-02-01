import { createServer as createHttpServer } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import type { ViteDevServer } from 'vite'
import { WebSocketServer, type WebSocket } from 'ws'
import { clerkMiddleware, getAuth } from '@clerk/express'

import { SimpleClaudeAgentSDKClient, configureSessionMcpServers } from '@claude-agent-kit/server'
import { WebSocketHandler } from '@claude-agent-kit/websocket'
import { registerApiRoutes } from './api'
import { registerRoutes } from './routes'
import { sandboxManager } from './sandbox/e2b-manager'
import { createSandboxMcpServer, setCurrentSandbox, setSandboxProvider } from './tools/sandbox-tools'
import { createSqlMcpServer } from './tools/sql-tools'
import { createPlaybookMcpServer, setCurrentPlaybookUser } from './tools/playbook-tools'
import { saveBranchMetadata, loadBranchMetadata, getWorldlineSiblings } from './api/branches'
import { getCurrentProjectId } from './api/projects'
import { saveSnapshot, findLatestSnapshotForSession, loadSnapshotByMessageUuid, getSessionSnapshots } from './sandbox/snapshot-storage'
import { upsertSession, createBranch, initAppDb, getSession, setSessionSandbox, setSessionSandboxStatus } from './db/app-db'

// Fallback project ID for unauthenticated requests (shouldn't happen in production)
const FALLBACK_PROJECT_ID = process.env.PROJECT_ID || 'default'

export interface CreateServerOptions {
  root?: string
}

// Track sandbox and user per WebSocket connection
const wsSandboxMap = new Map<WebSocket, string>()
const wsUserMap = new Map<WebSocket, string>()

// Track current active connection for sandbox provider
let currentWs: WebSocket | null = null
let currentSessionId: string | null = null

export async function createServer(options: CreateServerOptions = {}) {
  const root = options.root ?? process.cwd()
  const isProduction = process.env.NODE_ENV === 'production'
  const base = process.env.BASE ?? '/'

  // Create in-process MCP servers for sandbox, SQL, and playbook tools
  const sandboxMcp = createSandboxMcpServer()
  const sqlMcp = createSqlMcpServer()
  const playbookMcp = createPlaybookMcpServer()

  // Configure session to use these MCP servers
  configureSessionMcpServers(
    {
      sandbox: sandboxMcp,
      sql: sqlMcp,
      playbooks: playbookMcp,
    },
    [
      // Sandbox tools
      'mcp__sandbox__run_python',
      'mcp__sandbox__run_command',
      'mcp__sandbox__write_file',
      'mcp__sandbox__read_file',
      'mcp__sandbox__list_files',
      // SQL tools
      'mcp__sql__query',
      'mcp__sql__list_tables',
      'mcp__sql__describe_table',
      // Playbook tools
      'mcp__playbooks__create_playbook',
      'mcp__playbooks__update_playbook',
    ]
  )

  // Set up lazy sandbox provider - creates sandbox only when tools need it
  // Uses getOrCreateSandbox for graceful degradation (resume or create new)
  setSandboxProvider(async () => {
    if (!currentWs) {
      return null
    }

    try {
      let existingSandboxId: string | undefined
      let snapshotCommitSha: string | undefined

      // If we have a session, try to get existing sandbox and snapshot info
      if (currentSessionId) {
        const session = await getSession(currentSessionId)
        existingSandboxId = session?.sandboxId || undefined

        // Get latest snapshot commit SHA for validation
        const projectId = getCurrentProjectId()
        const latestSnapshot = await findLatestSnapshotForSession(projectId, currentSessionId)
        snapshotCommitSha = latestSnapshot?.commitSha
      }

      // Use getOrCreateSandbox for graceful degradation
      const { sandboxId, isNew, wasRestored } = await sandboxManager.getOrCreateSandbox(
        existingSandboxId,
        snapshotCommitSha
      )

      wsSandboxMap.set(currentWs, sandboxId)

      // Update database with sandbox ID and status (if we have a session)
      if (currentSessionId) {
        await setSessionSandboxStatus(currentSessionId, sandboxId, 'running')
      }

      // Notify client with status flags
      currentWs.send(JSON.stringify({
        type: 'sandbox_changed',
        sandboxId,
        sessionId: currentSessionId,
        isNew,
        wasRestored,
      }))

      return sandboxId
    } catch (error) {
      console.error('[Server] Failed to create sandbox on-demand:', error)
      return null
    }
  })

  const app = express()
  const httpServer = createHttpServer(app)
  const webSocketServer = new WebSocketServer({ server: httpServer })
  const sdkClient = new SimpleClaudeAgentSDKClient()
  const webSocketHandler = new WebSocketHandler(sdkClient, {
    thinkingLevel: 'default_on',
    // Provide worldlines for the 'branched' response to avoid race conditions
    getWorldlines: async (sessionId: string) => {
      const projectId = getCurrentProjectId()
      return getWorldlineSiblings(projectId, sessionId)
    },
    // Save branch metadata on the server BEFORE sending 'branched' event to client
    onBranchComplete: async (branchResult, ws) => {
      if (!branchResult.newSessionId || !branchResult.parentSessionId || !branchResult.branchPointMessageUuid) {
        return
      }
      const userId = wsUserMap.get(ws) || FALLBACK_PROJECT_ID

      // Save to app database
      try {
        await upsertSession(branchResult.newSessionId, userId)
        await createBranch(
          branchResult.newSessionId,
          branchResult.parentSessionId,
          branchResult.branchPointMessageUuid,
          branchResult.branchPointParentUuid
        )
      } catch (err) {
        console.error('[Server] Failed to save branch:', err)
      }

      // Also save to file-based storage for worldlines API
      const projectId = getCurrentProjectId()
      await saveBranchMetadata(projectId, {
        sessionId: branchResult.newSessionId,
        parentSessionId: branchResult.parentSessionId,
        branchPointMessageUuid: branchResult.branchPointMessageUuid,
        branchPointParentUuid: branchResult.branchPointParentUuid,
      })
    },

    // Auto-snapshot sandbox state when Claude finishes responding
    onTurnComplete: async ({ sessionId, lastMessageUuid }, ws) => {
      const sandboxId = wsSandboxMap.get(ws)
      if (!sandboxId) {
        return
      }

      const userId = wsUserMap.get(ws) || FALLBACK_PROJECT_ID

      try {
        // Load persisted messages to get the actual UUID (SDK uses different UUIDs in real-time vs disk)
        const { messages: persistedMessages } = await sdkClient.loadMessages(sessionId)

        // Extract session title from first user message (if not already set)
        let sessionTitle: string | undefined
        const session = await getSession(sessionId)
        if (!session?.title) {
          const firstUserMessage = persistedMessages.find(
            (msg) => (msg as { type?: string }).type === 'user'
          ) as { content?: Array<{ type?: string; text?: string }> } | undefined

          if (firstUserMessage?.content) {
            const textBlock = firstUserMessage.content.find((block) => block.type === 'text')
            if (textBlock?.text) {
              // Truncate to first 50 chars and clean up
              sessionTitle = textBlock.text.slice(0, 50).replace(/\n/g, ' ').trim()
              if (textBlock.text.length > 50) sessionTitle += '...'
            }
          }
        }

        // Register session in app database with title and sandbox status
        if (userId !== FALLBACK_PROJECT_ID) {
          try {
            await upsertSession(sessionId, userId, sessionTitle)
            await setSessionSandboxStatus(sessionId, sandboxId, 'running')
          } catch (err) {
            console.error('[Server] Failed to register session:', err)
          }
        }

        // Find the most recent assistant message
        let persistedUuid = lastMessageUuid
        for (let i = persistedMessages.length - 1; i >= 0; i--) {
          const msg = persistedMessages[i] as { type?: string; uuid?: string }
          if (msg.type === 'assistant' && msg.uuid) {
            persistedUuid = msg.uuid
            break
          }
        }

        // Create git snapshot in the sandbox
        const snapshot = await sandboxManager.createSnapshot(
          sandboxId,
          persistedUuid,
          `Turn complete - session ${sessionId}`
        )

        if (snapshot) {
          const projectId = getCurrentProjectId()
          await saveSnapshot(projectId, {
            commitSha: snapshot.commitSha,
            messageUuid: persistedUuid,
            sessionId,
            sandboxId,
            createdAt: snapshot.createdAt,
            description: snapshot.message,
          })
        }

        // Notify client that turn is complete (triggers file refresh)
        ws.send(JSON.stringify({ type: 'turn_complete', sessionId, sandboxId }))
      } catch (error) {
        console.error('[Server] Failed to create snapshot:', error)
        // Still notify client even if snapshot failed
        ws.send(JSON.stringify({ type: 'turn_complete', sessionId, sandboxId }))
      }
    },
  })

  // Track which session each connection is currently using
  const wsSessionMap = new Map<WebSocket, string>()

  // Helper to try to reconnect to a session's existing sandbox
  // Uses getOrCreateSandbox for graceful degradation
  async function tryReconnectSessionSandbox(ws: WebSocket, sessionId: string): Promise<void> {
    try {
      const session = await getSession(sessionId)
      if (!session?.sandboxId) {
        return
      }

      // Get latest snapshot for this session (or from parent branch)
      const projectId = getCurrentProjectId()
      let snapshot = await findLatestSnapshotForSession(projectId, sessionId)

      // If no snapshot for this session, check if it's a branch and restore from parent
      if (!snapshot) {
        const branchMeta = await loadBranchMetadata(projectId, sessionId)
        if (branchMeta?.branchPointParentUuid) {
          snapshot = await loadSnapshotByMessageUuid(projectId, branchMeta.branchPointParentUuid)
        }
      }

      // Use getOrCreateSandbox for graceful degradation
      const { sandboxId, isNew, wasRestored } = await sandboxManager.getOrCreateSandbox(
        session.sandboxId,
        snapshot?.commitSha
      )

      wsSandboxMap.set(ws, sandboxId)
      setCurrentSandbox(sandboxId)

      // Update database with new sandbox ID if changed, and set status to running
      if (sandboxId !== session.sandboxId) {
        await setSessionSandboxStatus(sessionId, sandboxId, 'running')
      } else {
        await setSessionSandboxStatus(sessionId, sandboxId, 'running')
      }

      // Notify client with status flags
      ws.send(JSON.stringify({
        type: 'sandbox_changed',
        sandboxId,
        sessionId,
        isNew,
        wasRestored,
      }))
    } catch (error) {
      console.error('[Server] Failed to reconnect sandbox:', error)
      // Clear the stale sandbox reference so a new one will be created on-demand
      try {
        await setSessionSandbox(sessionId, '')
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  webSocketServer.on('connection', async (ws) => {
    // Handle WebSocket with the standard handler
    void webSocketHandler.onOpen(ws)

    // Send connected message WITHOUT sandbox ID (will be sent when session is known)
    const connectMessage = {
      type: 'connected',
      message: 'Connected to the Agent.',
      sandboxId: null, // Will be set when session is identified
    }
    ws.send(JSON.stringify(connectMessage))

    ws.on('message', async (data) => {
      // Set current connection context for sandbox provider
      currentWs = ws

      // Ensure the right sandbox is set for this connection's messages
      const connSandboxId = wsSandboxMap.get(ws)
      if (connSandboxId) {
        setCurrentSandbox(connSandboxId)
      }

      const text = typeof data === 'string' ? data : data.toString()

      // Extract user ID and session ID from message
      try {
        const parsed = JSON.parse(text) as { userId?: string; sessionId?: string; type?: string }

        // Register user for this connection
        if (parsed.userId && !wsUserMap.has(ws)) {
          wsUserMap.set(ws, parsed.userId)
        }

        const userId = parsed.userId || wsUserMap.get(ws)

        // Set current user for playbook tools
        if (userId) {
          setCurrentPlaybookUser(userId)
        }

        // Track session for this connection
        if (parsed.sessionId) {
          const previousSession = wsSessionMap.get(ws)
          if (previousSession !== parsed.sessionId) {
            wsSessionMap.set(ws, parsed.sessionId)
            currentSessionId = parsed.sessionId
          }
        }

        // Create or reconnect to sandbox when we see a chat message
        // Uses getOrCreateSandbox for graceful degradation
        if (userId && parsed.type === 'chat') {
          const chatSessionId = parsed.sessionId || null
          const chatUserId = userId

          ;(async () => {
            try {
              if (wsSandboxMap.has(ws)) return

              if (chatSessionId) {
                await upsertSession(chatSessionId, chatUserId)
                const session = await getSession(chatSessionId)

                // Get latest snapshot commit SHA for validation
                const projectId = getCurrentProjectId()
                const latestSnapshot = await findLatestSnapshotForSession(projectId, chatSessionId)

                // Use getOrCreateSandbox for graceful degradation
                const { sandboxId, isNew, wasRestored } = await sandboxManager.getOrCreateSandbox(
                  session?.sandboxId || undefined,
                  latestSnapshot?.commitSha
                )

                wsSandboxMap.set(ws, sandboxId)
                setCurrentSandbox(sandboxId)

                // Update database with sandbox status
                await setSessionSandboxStatus(chatSessionId, sandboxId, 'running')

                ws.send(JSON.stringify({
                  type: 'sandbox_changed',
                  sandboxId,
                  sessionId: chatSessionId,
                  isNew,
                  wasRestored,
                }))
                return
              }

              // No session ID - just create a new sandbox
              const newSandboxId = await sandboxManager.createSandbox()
              wsSandboxMap.set(ws, newSandboxId)
              setCurrentSandbox(newSandboxId)

              ws.send(JSON.stringify({
                type: 'sandbox_changed',
                sandboxId: newSandboxId,
                sessionId: chatSessionId,
                isNew: true,
                wasRestored: false,
              }))
            } catch (err) {
              console.error('[Server] Failed to setup sandbox:', err)
            }
          })()
        }

        // When resuming a session, try to reconnect to its existing sandbox
        if (parsed.type === 'resume' && parsed.sessionId) {
          const resumeUserId = userId || FALLBACK_PROJECT_ID
          currentSessionId = parsed.sessionId

          ;(async () => {
            try {
              await upsertSession(parsed.sessionId!, resumeUserId)
              await tryReconnectSessionSandbox(ws, parsed.sessionId!)
            } catch (err) {
              console.error('[Server] Failed to handle resume:', err)
            }
          })()
        }

        // When branching, restore sandbox to the state AT the branch point
        if (parsed.type === 'branch') {
          const branchMsg = parsed as { sourceSessionId?: string; branchAtMessageUuid?: string }
          if (branchMsg.sourceSessionId && branchMsg.branchAtMessageUuid) {
            const sandboxId = wsSandboxMap.get(ws)
            if (sandboxId) {
              try {
                const projectId = getCurrentProjectId()
                const branchPointUuid = branchMsg.branchAtMessageUuid

                let snapshot = await loadSnapshotByMessageUuid(projectId, branchPointUuid)

                // If not found, try the parent (branch point might be a user message)
                if (!snapshot) {
                  const { messages: sourceMessages } = await sdkClient.loadMessages(branchMsg.sourceSessionId!)
                  const branchPointMessage = sourceMessages.find(
                    (msg) => (msg as { uuid?: string }).uuid === branchPointUuid
                  )
                  const parentUuid = branchPointMessage
                    ? (branchPointMessage as { parentUuid?: string | null }).parentUuid || undefined
                    : undefined

                  if (parentUuid) {
                    snapshot = await loadSnapshotByMessageUuid(projectId, parentUuid)
                  }
                }

                if (snapshot) {
                  await sandboxManager.restoreSnapshot(sandboxId, snapshot.commitSha)
                }
              } catch (err) {
                console.error('[Server] Failed to restore sandbox for branch:', err)
              }
            }
          }
        }
      } catch {
        // Not JSON or missing fields - continue normally
      }

      webSocketHandler.onMessage(ws, text).catch((error) => {
        console.error('Failed to handle WebSocket message', error)
      })
    })

    ws.on('close', async () => {
      webSocketHandler.onClose(ws)

      // Pause sandbox when client disconnects to preserve state
      // Note: onTurnComplete already snapshots after each turn, so we just need to pause
      const closingSandboxId = wsSandboxMap.get(ws)
      const closingSessionId = wsSessionMap.get(ws)

      if (closingSandboxId) {
        wsSandboxMap.delete(ws)
        wsSessionMap.delete(ws)
        wsUserMap.delete(ws)

        try {
          // Pause sandbox using beta API (proper pause, not just disconnect)
          await sandboxManager.pauseSandbox(closingSandboxId)

          // Update database status to paused
          if (closingSessionId) {
            await setSessionSandboxStatus(closingSessionId, closingSandboxId, 'paused')
          }
        } catch {
          // Sandbox may have already timed out or been killed
          // Update status to unknown since we don't know its actual state
          if (closingSessionId) {
            try {
              await setSessionSandboxStatus(closingSessionId, closingSandboxId, 'unknown')
            } catch {
              // Ignore database errors during cleanup
            }
          }
        }
      }
    })

    ws.on('error', () => {
      // WebSocket errors are expected during disconnects
    })
  })

  // Add Clerk middleware for API routes (MUST come before Vite)
  app.use('/api', clerkMiddleware())

  // Register API routes BEFORE Vite middleware (so /api/* doesn't get caught by catch-all)
  await registerApiRoutes(app)

  let templateHtml = ''
  let vite: ViteDevServer | undefined

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      base,
    })
    app.use(vite.middlewares)
  } else {
    templateHtml = await fs.readFile(path.resolve(root, 'dist/client/index.html'), 'utf-8')
    const compression = (await import('compression')).default
    const sirv = (await import('sirv')).default
    app.use(compression())
    app.use(base, sirv(path.resolve(root, 'dist/client'), { extensions: [] }))
  }

  registerRoutes(app, {
    base,
    isProduction,
    root,
    templateHtml,
    vite,
  })

  // Cleanup on server shutdown
  process.on('SIGINT', async () => {
    await sandboxManager.cleanup()
    process.exit(0)
  })

  return { app, vite, httpServer, webSocketServer }
}
