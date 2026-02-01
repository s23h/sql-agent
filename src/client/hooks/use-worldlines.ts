import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorldlineBranch } from '@/components/messages/worldline-navigator'
import { navigateTo } from '@/lib/route'

type UseWorldlinesOptions = {
  sessionId: string | null
  projectId: string | null
  selectChatSession: (params: {
    sessionId: string | null
    projectId: string | null
  }) => void
}

export type WorldlinesState = {
  worldlines: WorldlineBranch[]
  setWorldlines: React.Dispatch<React.SetStateAction<WorldlineBranch[]>>
  worldlinesSetFromBranchRef: React.MutableRefObject<boolean>
  refreshWorldlines: () => void
  handleWorldlineNavigate: (targetSessionId: string) => void
}

/**
 * Worldline state, fetch, and navigation logic
 */
export function useWorldlines({
  sessionId,
  projectId,
  selectChatSession,
}: UseWorldlinesOptions): WorldlinesState {
  const [worldlines, setWorldlines] = useState<WorldlineBranch[]>([])
  const [worldlinesRefreshTrigger, setWorldlinesRefreshTrigger] = useState(0)

  // Track if worldlines were just set from a branch response (skip redundant fetch)
  const worldlinesSetFromBranchRef = useRef(false)

  useEffect(() => {
    if (!sessionId || !projectId) {
      setWorldlines([])
      return
    }

    // Skip fetch if worldlines were just set from a branch response
    if (worldlinesSetFromBranchRef.current) {
      worldlinesSetFromBranchRef.current = false
      return
    }

    const fetchWorldlines = async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/worldlines`,
        )
        if (response.ok) {
          const data = await response.json()
          setWorldlines(data.worldlines || [])
        }
      } catch {
        // Worldlines are optional
      }
    }

    fetchWorldlines()
  }, [sessionId, projectId, worldlinesRefreshTrigger])

  const refreshWorldlines = useCallback(() => {
    setWorldlinesRefreshTrigger((prev) => prev + 1)
  }, [])

  const handleWorldlineNavigate = useCallback(
    (targetSessionId: string) => {
      if (targetSessionId === sessionId || !projectId) return

      // Just navigate - server handles sandbox restoration via tryReconnectSessionSandbox
      // when the resume message is received
      navigateTo(
        `/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(targetSessionId)}`,
      )
      selectChatSession({ sessionId: targetSessionId, projectId })
    },
    [sessionId, selectChatSession, projectId],
  )

  return {
    worldlines,
    setWorldlines,
    worldlinesSetFromBranchRef,
    refreshWorldlines,
    handleWorldlineNavigate,
  }
}
