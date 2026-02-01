/**
 * Branch metadata storage and retrieval
 * Tracks worldline relationships between sessions
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { getProjectsRoot } from './projects'

export interface BranchMetadata {
  sessionId: string
  parentSessionId: string
  branchPointMessageUuid: string    // The message that was replaced (exists in parent only)
  branchPointParentUuid?: string    // The message BEFORE the branch point (exists in BOTH sessions)
  worldlineId: string  // Root session ID of the worldline family
  createdAt: number
}

export interface WorldlineSibling {
  sessionId: string
  parentSessionId: string | null  // Parent session ID (null for root session)
  branchPointMessageUuid: string
  branchPointParentUuid?: string  // The message BEFORE the branch point (exists in BOTH sessions)
  createdAt: number
  lastModifiedAt: number  // File mtime - used to determine which branch to show by default
}

const BRANCH_METADATA_SUFFIX = '.branch.json'

/**
 * Save branch metadata for a new branch
 */
export async function saveBranchMetadata(
  projectId: string,
  metadata: Omit<BranchMetadata, 'worldlineId' | 'createdAt'>
): Promise<void> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) return

  const projectDir = path.join(projectsRoot, projectId)

  // Determine the worldlineId by checking if parent has a worldlineId
  const parentMeta = await loadBranchMetadata(projectId, metadata.parentSessionId)
  const worldlineId = parentMeta?.worldlineId ?? metadata.parentSessionId

  const fullMetadata: BranchMetadata = {
    ...metadata,
    worldlineId,
    createdAt: Date.now(),
  }

  const metaFilePath = path.join(projectDir, `${metadata.sessionId}${BRANCH_METADATA_SUFFIX}`)
  await writeFile(metaFilePath, JSON.stringify(fullMetadata, null, 2))
}

/**
 * Load branch metadata for a session
 */
export async function loadBranchMetadata(
  projectId: string,
  sessionId: string
): Promise<BranchMetadata | null> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) return null

  const metaFilePath = path.join(projectsRoot, projectId, `${sessionId}${BRANCH_METADATA_SUFFIX}`)

  try {
    const content = await readFile(metaFilePath, 'utf8')
    return JSON.parse(content) as BranchMetadata
  } catch {
    return null
  }
}

/**
 * Get all sessions in the same worldline family (share same root)
 */
export async function getWorldlineSiblings(
  projectId: string,
  sessionId: string
): Promise<WorldlineSibling[]> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) return []

  const projectDir = path.join(projectsRoot, projectId)

  // First, find the worldlineId for this session
  const meta = await loadBranchMetadata(projectId, sessionId)
  const worldlineId = meta?.worldlineId ?? sessionId  // If no metadata, it's a root session

  // Scan all branch metadata files in the project
  let entries
  try {
    entries = await readdir(projectDir, { withFileTypes: true })
  } catch {
    return []
  }

  const siblings: WorldlineSibling[] = []

  // Helper to get last modified time from session file
  async function getLastModifiedAt(sid: string): Promise<number> {
    try {
      const sessionPath = path.join(projectDir, `${sid}.jsonl`)
      const stats = await stat(sessionPath)
      return stats.mtimeMs
    } catch {
      return 0
    }
  }

  // The root session is always a sibling
  const rootLastModified = await getLastModifiedAt(worldlineId)
  siblings.push({
    sessionId: worldlineId,
    parentSessionId: null,  // Root has no parent
    branchPointMessageUuid: '',  // Root has no branch point
    createdAt: 0,  // Root was created at the beginning
    lastModifiedAt: rootLastModified,
  })

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(BRANCH_METADATA_SUFFIX)) {
      continue
    }

    const metaPath = path.join(projectDir, entry.name)
    try {
      const content = await readFile(metaPath, 'utf8')
      const branchMeta = JSON.parse(content) as BranchMetadata

      // Check if this branch belongs to the same worldline family
      if (branchMeta.worldlineId === worldlineId) {
        const lastModifiedAt = await getLastModifiedAt(branchMeta.sessionId)
        siblings.push({
          sessionId: branchMeta.sessionId,
          parentSessionId: branchMeta.parentSessionId,
          branchPointMessageUuid: branchMeta.branchPointMessageUuid,
          branchPointParentUuid: branchMeta.branchPointParentUuid,
          createdAt: branchMeta.createdAt,
          lastModifiedAt,
        })
      }
    } catch {
      continue
    }
  }

  // Sort by creation time (navigation order), but also track which is most recently modified
  siblings.sort((a, b) => a.createdAt - b.createdAt)

  return siblings
}

/**
 * Get branches at a specific message UUID across all worldline siblings
 */
export async function getBranchesAtMessage(
  projectId: string,
  sessionId: string,
  messageUuid: string
): Promise<WorldlineSibling[]> {
  const siblings = await getWorldlineSiblings(projectId, sessionId)

  // Filter to only branches at this specific message
  return siblings.filter(s => s.branchPointMessageUuid === messageUuid)
}
