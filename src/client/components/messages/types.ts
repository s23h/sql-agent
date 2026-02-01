import type { ChatMessage, ChatMessagePart } from '@claude-agent-kit/messages'

export interface FileOpenLocation {
  startLine?: number
  endLine?: number
}

export interface FileOpener {
  open(filePath: string, location?: FileOpenLocation): void
  openContent(content: string, title: string, preserveFocus?: boolean): Promise<void> | void
}

export interface ClaudeMessageContext {
  fileOpener: FileOpener
  platform?: 'macos' | 'windows' | 'linux'
  assetUris?: Record<string, { light?: string; dark?: string }>
  safeFocus?: (element: HTMLElement) => void
  onBranch?: (messageId: string) => void  // Worldline branching callback
  // Inline editing context
  editingMessageId?: string | null
  onStartEdit?: (messageId: string) => void
  onCancelEdit?: () => void
  onSubmitEdit?: (messageId: string, newContent: string) => void
  // Track Skill tool invocations to hide their tool_result blocks
  skillToolUseIds?: Set<string>
}

export interface MessageProps {
  message: ChatMessage
  context: ClaudeMessageContext
  isHighlighted?: boolean
  editingContent?: string  // Content to show when editing this message
}

export interface MessagePartProps {
  content: ChatMessagePart
  context: ClaudeMessageContext
  plainText?: boolean
}
