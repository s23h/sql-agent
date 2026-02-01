import { useEffect, useRef, useState } from 'react'
import { Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { SessionSummary } from './types'

const DEFAULT_VISIBLE_COUNT = 5

type SessionListProps = {
  sessions: SessionSummary[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  isLoading: boolean
  errorMessage: string | null
  onRename?: (sessionId: string, newTitle: string) => void
  onDelete?: (sessionId: string) => void
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelect,
  isLoading,
  errorMessage,
  onRename,
  onDelete,
}: SessionListProps) {
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null)
  // Delay showing the loading spinner to avoid double-loading flash with Clerk auth
  const [showLoading, setShowLoading] = useState(false)
  // Track if all sessions are shown or just the first few
  const [isExpanded, setIsExpanded] = useState(false)

  // Track which session is being edited
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowLoading(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowLoading(false)
    }
  }, [isLoading])

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }
  }, [selectedSessionId, sessions])

  // Focus input when editing starts
  useEffect(() => {
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSessionId])

  const handleStartRename = (session: SessionSummary) => {
    setEditingSessionId(session.id)
    setEditValue(session.prompt || '')
  }

  const handleSubmitRename = () => {
    if (editingSessionId && editValue.trim() && onRename) {
      onRename(editingSessionId, editValue.trim())
    }
    setEditingSessionId(null)
    setEditValue('')
  }

  const handleCancelRename = () => {
    setEditingSessionId(null)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  const handleDelete = (sessionId: string) => {
    onDelete?.(sessionId)
  }

  if (isLoading && showLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (errorMessage) {
    return <div className="px-2 text-xs text-destructive">{errorMessage}</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="px-2 text-xs text-muted-foreground">
        No sessions yet.
      </div>
    )
  }

  const visibleSessions = isExpanded ? sessions : sessions.slice(0, DEFAULT_VISIBLE_COUNT)
  const hasMore = sessions.length > DEFAULT_VISIBLE_COUNT

  return (
    <div className="space-y-1 overflow-hidden">
      {visibleSessions.map((session) => {
        const isSelected = session.id === selectedSessionId
        const isEditing = editingSessionId === session.id

        return (
          <div
            key={session.id}
            className="group relative w-full"
          >
            <button
              type="button"
              ref={isSelected ? selectedButtonRef : null}
              onClick={() => !isEditing && onSelect(session.id)}
              className={cn(
                'flex w-full overflow-hidden rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'bg-muted' : 'bg-transparent',
              )}
            >
              <div className="min-w-0 flex-1 pr-8">
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSubmitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-sm font-medium text-foreground outline-none ring-1 ring-ring rounded px-1 -mx-1"
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground">
                    {(() => {
                      const title = session.prompt || 'Untitled session'
                      return title.length > 20 ? title.slice(0, 20) + '…' : title
                    })()}
                  </p>
                )}
              </div>
            </button>

            {/* 3-dot menu - visible on hover */}
            {!isEditing && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded bg-background hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right">
                    <DropdownMenuItem onSelect={() => handleStartRename(session)}>
                      <Pencil className="h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleDelete(session.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )
      })}

      {/* Show more/less button */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
        >
          {isExpanded ? 'Show less' : `Show ${sessions.length - DEFAULT_VISIBLE_COUNT} more`}
        </button>
      )}
    </div>
  )
}
