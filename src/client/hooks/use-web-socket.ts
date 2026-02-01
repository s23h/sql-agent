import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionSDKOptions } from '@claude-agent-kit/server'

import { ROUTE_CHANGE_EVENT, parseRoute } from '@/lib/route'

type WebSocketPayload = Record<string, unknown>

interface UseWebSocketOptions {
  url: string | null
  userId?: string | null
  onMessage?: (message: WebSocketPayload) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

interface UseWebSocketResult {
  isConnected: boolean
  reconnectAttempts: number
  sandboxId: string | null
  sendMessage: (message: WebSocketPayload) => void
  setSDKOptions: (
    options: Partial<SessionSDKOptions>,
    sessionId?: string | null,
  ) => void
  disconnect: () => void
  reconnect: () => void
  sendBranchMessage: (sourceSessionId: string, branchAtMessageUuid: string, content: string) => void
}

export function useWebSocket({
  url,
  userId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [sandboxId, setSandboxId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageQueueRef = useRef<string[]>([])
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(true)
  const routeSessionIdRef = useRef<string | null>(null)
  const suppressRouteChangesRef = useRef(false)
  const userIdRef = useRef(userId)
  const handlersRef = useRef({
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  })

  useEffect(() => {
    handlersRef.current = { onMessage, onConnect, onDisconnect, onError }
  }, [onMessage, onConnect, onDisconnect, onError])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const teardown = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendResumeMessage = useCallback((sessionId: string | null) => {
    if (!sessionId) {
      return
    }

    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(
      JSON.stringify({
        type: 'resume',
        sessionId,
      }),
    )
  }, [])

  const connect = useCallback(() => {
    if (!url || typeof window === 'undefined') {
      return
    }

    shouldReconnectRef.current = false
    teardown()
    shouldReconnectRef.current = true

    try {
      const socket = new WebSocket(url)
      wsRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
        handlersRef.current.onConnect?.()

        // Re-enable route change handling now that we're connected
        suppressRouteChangesRef.current = false

        // Get session ID fresh from URL - don't rely on refs which might be stale
        const sessionId = getSessionIdFromLocation()
        routeSessionIdRef.current = sessionId

        // Only send resume if there's actually a session ID in the URL
        if (sessionId) {
          sendResumeMessage(sessionId)
        }

        while (messageQueueRef.current.length > 0) {
          const payload = messageQueueRef.current.shift()
          if (payload) {
            socket.send(payload)
          }
        }
      }

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketPayload
          // Extract sandboxId from connected message
          if (parsed.type === 'connected' && typeof parsed.sandboxId === 'string') {
            setSandboxId(parsed.sandboxId)
          }
          // Handle sandbox change when resuming a session with a different sandbox
          if (parsed.type === 'sandbox_changed' && typeof parsed.sandboxId === 'string') {
            setSandboxId(parsed.sandboxId)
          }
          handlersRef.current.onMessage?.(parsed)
        } catch {
          // Invalid JSON message from server
        }
      }

      socket.onerror = (event) => {
        handlersRef.current.onError?.(event)
      }

      socket.onclose = () => {
        setIsConnected(false)
        handlersRef.current.onDisconnect?.()
        wsRef.current = null

        if (
          shouldReconnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          const nextAttempt = reconnectAttemptsRef.current + 1
          reconnectAttemptsRef.current = nextAttempt
          setReconnectAttempts(nextAttempt)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectDelay)
        }
      }
    } catch {
      // WebSocket connection failed
    }
  }, [url, teardown, reconnectDelay, maxReconnectAttempts, sendResumeMessage])

  const sendMessage = useCallback(
    (message: WebSocketPayload) => {
      // Include userId in all messages for server-side user tracking
      const messageWithUser = userIdRef.current
        ? { ...message, userId: userIdRef.current }
        : message
      const serialized = JSON.stringify(messageWithUser)
      const socket = wsRef.current

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(serialized)
        return
      }

      messageQueueRef.current.push(serialized)

      if (!isConnected && reconnectAttemptsRef.current >= maxReconnectAttempts) {
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
        connect()
      }
    },
    [isConnected, maxReconnectAttempts, connect],
  )

  const setSDKOptions = useCallback(
    (options: Partial<SessionSDKOptions>, sessionId?: string | null) => {
      const payload: WebSocketPayload = {
        type: 'setSDKOptions',
        options,
      }

      if (sessionId !== undefined) {
        payload.sessionId = sessionId
      }

      sendMessage(payload)
    },
    [sendMessage],
  )

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    // Suppress route change handling during disconnect/reconnect cycle
    suppressRouteChangesRef.current = true
    teardown()
    setIsConnected(false)
    setSandboxId(null)
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
    // Clear route session ref to prevent stale session from being resumed
    routeSessionIdRef.current = null
    // Clear any queued messages
    messageQueueRef.current = []
  }, [teardown])

  const reconnectNow = useCallback(() => {
    shouldReconnectRef.current = true
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
    connect()
  }, [connect])

  const sendBranchMessage = useCallback(
    (sourceSessionId: string, branchAtMessageUuid: string, content: string) => {
      sendMessage({
        type: 'branch',
        sourceSessionId,
        branchAtMessageUuid,
        content,
      })
    },
    [sendMessage],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleRouteChange = () => {
      // Skip route change handling during disconnect/reconnect cycle
      if (suppressRouteChangesRef.current) {
        return
      }

      const nextSessionId = getSessionIdFromLocation()
      const previousSessionId = routeSessionIdRef.current
      routeSessionIdRef.current = nextSessionId

      if (nextSessionId && nextSessionId !== previousSessionId) {
        sendResumeMessage(nextSessionId)
      }
    }

    // Don't call handleRouteChange on mount - socket.onopen handles initial resume
    // handleRouteChange()

    window.addEventListener('popstate', handleRouteChange)
    window.addEventListener(ROUTE_CHANGE_EVENT, handleRouteChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleRouteChange)
    }
  }, [sendResumeMessage])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    reconnectAttempts,
    sandboxId,
    sendMessage,
    setSDKOptions,
    disconnect,
    reconnect: reconnectNow,
    sendBranchMessage,
  }
}

function getSessionIdFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const { sessionId } = parseRoute(window.location.pathname)
  return sessionId
}
