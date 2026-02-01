import { useMemo, useState, useEffect, useRef } from 'react'

import type { ChatMessagePart } from '@claude-agent-kit/messages'
import { parseUserFacingContent } from '../../lib/message-parsing'
import type { ClaudeMessageContext } from './types'
import { MessagePart } from './message-part'
import { FileReferenceChip } from './file-reference-chip'
import { ExpandableContent } from './expandable-content'
import { cn } from '../../lib/utils'
import { MarkdownContent } from './tool-use/markdown-content'

type UserMessageProps = {
  parts: ChatMessagePart[]
  context: ClaudeMessageContext
  isHighlighted: boolean
  isEditing?: boolean
  editingContent?: string
  messageId?: string
}

export function UserMessage({ parts, context, isHighlighted, isEditing, editingContent, messageId }: UserMessageProps) {
  // All hooks must be called before any early returns
  const [localContent, setLocalContent] = useState(editingContent ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const reversedParts = useMemo(() => [...parts].reverse(), [parts])
  const parsedParts = useMemo(
    () => reversedParts.map((part) => parseUserFacingContent(part.content)),
    [reversedParts]
  )

  const containerClassName = cn(
    'relative flex flex-col items-start gap-0 ml-0 items-start text-left',
    isHighlighted && 'z-10 !opacity-100'
  )

  // Update local content when editingContent changes
  useEffect(() => {
    if (editingContent !== undefined) {
      setLocalContent(editingContent)
    }
  }, [editingContent])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length
    }
  }, [isEditing])

  const handleSubmit = () => {
    if (messageId && context.onSubmitEdit) {
      context.onSubmitEdit(messageId, localContent)
    }
  }

  const handleCancel = () => {
    if (context.onCancelEdit) {
      context.onCancelEdit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Render editing mode
  if (isEditing) {
    return (
      <div className="relative flex flex-col items-start gap-2 w-full">
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[80px] p-4 rounded border border-primary bg-card text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Enter your message for the new worldline..."
        />
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!localContent.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Branch
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-xs font-medium rounded border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          Press Cmd+Enter to submit, Escape to cancel
        </div>
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      {reversedParts.map((part, index) => {
        const parsed = parsedParts[index]

        if (part.content.type === 'image' || part.content.type === 'document') {
          return (
            <div key={`attachment-${index}`}>
              <MessagePart content={part} context={context} />
            </div>
          )
        }

        if (parsed) {
          switch (parsed.type) {
            case 'interrupt':
              return (
                <div className="w-full italic text-muted-foreground" key={`interrupt-${index}`}>
                  {parsed.friendlyMessage}
                </div>
              )
            case 'ideSelection':
              return (
                <FileReferenceChip
                  key={`selection-${index}`}
                  label={parsed.selection.label}
                  filePath={parsed.selection.filePath}
                  location={{
                    startLine: parsed.selection.startLine,
                    endLine: parsed.selection.endLine,
                  }}
                  context={context}
                />
              )
            case 'ideOpenedFile':
              return (
                <FileReferenceChip
                  key={`opened-${index}`}
                  label={parsed.file.label}
                  filePath={parsed.file.filePath}
                  context={context}
                />
              )
            case 'slashCommandResult':
              return (
                <div className="w-full select-text font-mono text-sm" key={`slash-${index}`}>
                  <MarkdownContent content={parsed.result} context={context} />
                </div>
              )
            case 'text':
              if (parsed.isSlashCommand) {
                return (
                  <div
                  className="inline-block max-w-fit select-text overflow-auto whitespace-pre-wrap rounded border border-border bg-card px-[6px] py-1 font-mono text-sm"
                    key={`command-${index}`}
                  >
                    {parsed.text}
                  </div>
                )
              }
              break
          }
        }

        return (
          <div
            className="inline-block max-w-fit select-text overflow-auto whitespace-pre-wrap rounded border border-border bg-card px-4 py-4"
            key={`content-${index}`}
          >
            <ExpandableContent part={part} context={context} />
          </div>
        )
      })}
    </div>
  )
}
