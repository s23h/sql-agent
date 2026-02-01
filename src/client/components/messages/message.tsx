import { useState } from 'react'
import type { MessageProps } from './types'
import { AssistantMessage } from './assistant-message'
import { UserMessage } from './user-message'

export function BranchButton({ messageId, onStartEdit }: { messageId: string; onStartEdit: (id: string) => void }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={() => onStartEdit(messageId)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="branch-button"
      title="Branch from this point (create new worldline)"
      style={{
        opacity: isHovered ? 1 : 0.5,
        padding: '2px 8px',
        fontSize: '11px',
        background: isHovered ? '#047A55' : 'transparent',
        border: '1px solid #047A55',
        borderRadius: '4px',
        color: isHovered ? 'white' : '#047A55',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      ⎇ Branch
    </button>
  )
}

export function Message({ message, context, isHighlighted, editingContent }: MessageProps) {
  if (message.isEmpty) {
    return null
  }

  // Hide user messages that only contain skill content (injected by SDK)
  if (message.type === 'user') {
    const hasOnlySkillContent = message.content.every(part => {
      if (part.content.type === 'text') {
        const text = (part.content as { text?: string }).text ?? ''
        return text.startsWith('Base directory for this skill:')
      }
      return false
    })
    if (hasOnlySkillContent && message.content.length > 0) {
      return null
    }
  }

  const isEditing = context.editingMessageId === message.id

  if (message.type === 'user') {
    return (
      <UserMessage
        parts={message.content}
        context={context}
        isHighlighted={Boolean(isHighlighted)}
        isEditing={isEditing}
        editingContent={editingContent}
        messageId={message.id}
      />
    )
  }

  if (message.type === 'assistant') {
    return (
      <AssistantMessage
        parts={message.content}
        context={context}
        isHighlighted={Boolean(isHighlighted)}
      />
    )
  }

  return null
}
