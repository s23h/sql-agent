import { useCallback, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { navigateTo } from '@/lib/route'
import { chatMessagesAtom, chatSessionInfoAtom } from '@/state/chat-atoms'

type UsePlaybookRunnerOptions = {
  disconnect: () => void
  reconnect: () => void
  selectChatSession: (params: {
    sessionId: string | null
    projectId: string | null
  }) => void
  sendMessage: (message: {
    type: 'chat'
    content: string
    sessionId: string | null
    attachments: undefined
  }) => void
}

export type PlaybookRunnerState = {
  handleRunPlaybook: (prompt: string) => void
  handleNewSession: () => void
}

/**
 * Run playbook with session reset functionality
 */
export function usePlaybookRunner({
  disconnect,
  reconnect,
  selectChatSession,
  sendMessage,
}: UsePlaybookRunnerOptions): PlaybookRunnerState {
  const setMessages = useSetAtom(chatMessagesAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)

  // Start a new session by disconnecting and reconnecting
  const handleNewSession = useCallback(() => {
    // First disconnect to stop any incoming messages that might reset state
    disconnect()

    // Clear current session state
    selectChatSession({ sessionId: null, projectId: null })

    // Navigate to root using replace to avoid history back issues
    // Use a slight delay to let React's effects settle
    setTimeout(() => {
      navigateTo('/', { replace: true })

      // Reconnect after navigation is complete
      setTimeout(() => {
        reconnect()
      }, 50)
    }, 10)
  }, [selectChatSession, disconnect, reconnect])

  // Run a playbook - start new session with the playbook's prompt
  const handleRunPlaybook = useCallback(
    (prompt: string) => {
      // First disconnect to stop any incoming messages
      disconnect()

      // Clear current session state
      selectChatSession({ sessionId: null, projectId: null })
      setMessages([])

      // Navigate to root and reconnect, then send the prompt
      setTimeout(() => {
        navigateTo('/', { replace: true })

        setTimeout(() => {
          reconnect()

          // After reconnecting, send the playbook prompt
          setTimeout(() => {
            if (prompt.trim()) {
              sendMessage({
                type: 'chat',
                content: prompt.trim(),
                sessionId: null,
                attachments: undefined,
              })
              setSessionInfo((previous) => ({
                ...previous,
                isBusy: true,
              }))
            }
          }, 100)
        }, 50)
      }, 10)
    },
    [disconnect, reconnect, selectChatSession, setMessages, sendMessage, setSessionInfo],
  )

  // Listen for 'run-playbook' custom events from the sidebar
  useEffect(() => {
    const handler = (e: CustomEvent<{ prompt: string }>) => {
      handleRunPlaybook(e.detail.prompt)
    }

    window.addEventListener('run-playbook', handler as EventListener)
    return () => {
      window.removeEventListener('run-playbook', handler as EventListener)
    }
  }, [handleRunPlaybook])

  return {
    handleRunPlaybook,
    handleNewSession,
  }
}
