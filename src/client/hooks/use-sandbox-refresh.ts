import { useCallback, useRef, useState } from 'react'

type ToolCategory = 'sandbox' | 'playbooks'

export type SandboxRefreshState = {
  fileRefreshTrigger: number
  toolsUsedThisTurnRef: React.MutableRefObject<Set<ToolCategory>>
  triggerDebouncedFileRefresh: () => void
  triggerImmediateFileRefresh: () => void
  clearToolsUsedThisTurn: () => void
}

/**
 * Tool tracking and debounced file refresh for sandbox operations
 */
export function useSandboxRefresh(): SandboxRefreshState {
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0)

  // Track which tool categories were used during the current turn
  const toolsUsedThisTurnRef = useRef<Set<ToolCategory>>(new Set())

  // Debounced file refresh for intermediate tool results
  const fileRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerDebouncedFileRefresh = useCallback(() => {
    if (fileRefreshTimerRef.current) {
      clearTimeout(fileRefreshTimerRef.current)
    }
    fileRefreshTimerRef.current = setTimeout(() => {
      setFileRefreshTrigger((prev) => prev + 1)
      fileRefreshTimerRef.current = null
    }, 500)
  }, [])

  const triggerImmediateFileRefresh = useCallback(() => {
    // Cancel any pending debounced refresh
    if (fileRefreshTimerRef.current) {
      clearTimeout(fileRefreshTimerRef.current)
      fileRefreshTimerRef.current = null
    }
    setFileRefreshTrigger((prev) => prev + 1)
  }, [])

  const clearToolsUsedThisTurn = useCallback(() => {
    toolsUsedThisTurnRef.current = new Set()
  }, [])

  return {
    fileRefreshTrigger,
    toolsUsedThisTurnRef,
    triggerDebouncedFileRefresh,
    triggerImmediateFileRefresh,
    clearToolsUsedThisTurn,
  }
}
