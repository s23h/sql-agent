import { useMemo, useState } from 'react'

export type CommandAction = {
  id: string
  label: string
  description?: string
  hasChevron?: boolean
}

type CommandEntry = {
  action: CommandAction
  section: string
  handler: () => void
}

export type CommandRegistry = {
  getCommandsBySection: () => Record<string, CommandAction[]>
  registerAction: (
    action: CommandAction,
    section: string,
    handler: () => void,
  ) => void
  executeCommand: (id: string) => void
}

/**
 * Command palette registration hook
 */
export function useCommandRegistry(): CommandRegistry {
  const [commandEntries, setCommandEntries] = useState<Map<string, CommandEntry>>(
    () => new Map(),
  )

  const commandRegistry = useMemo<CommandRegistry>(() => {
    return {
      getCommandsBySection: () => {
        const sections: Record<string, CommandAction[]> = {}
        commandEntries.forEach(({ action, section }) => {
          const existing = sections[section] ?? []
          sections[section] = [...existing, action]
        })
        return sections
      },
      registerAction: (
        action: CommandAction,
        section: string,
        handler: () => void,
      ) => {
        setCommandEntries((previous) => {
          if (previous.has(action.id)) {
            return previous
          }
          const next = new Map(previous)
          next.set(action.id, { action, section, handler })
          return next
        })
      },
      executeCommand: (id: string) => {
        const entry = commandEntries.get(id)
        entry?.handler()
      },
    }
  }, [commandEntries])

  return commandRegistry
}
