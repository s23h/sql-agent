import { useEffect, useRef, useState } from 'react'
import { Loader2, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import { PlaybookSummary } from './types'

type PlaybookListProps = {
  playbooks: PlaybookSummary[]
  isLoading?: boolean
  onRun: (playbook: PlaybookSummary) => void
  onRename: (id: string, newName: string) => void
  onDelete: (id: string) => void
}

export function PlaybookList({
  playbooks,
  isLoading,
  onRun,
  onRename,
  onDelete,
}: PlaybookListProps) {
  // Track which playbook is being edited
  const [editingPlaybookId, setEditingPlaybookId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Track playbook pending confirmation
  const [pendingPlaybook, setPendingPlaybook] = useState<PlaybookSummary | null>(null)

  const handlePlaybookClick = (playbook: PlaybookSummary) => {
    setPendingPlaybook(playbook)
  }

  const handleConfirmRun = () => {
    if (pendingPlaybook) {
      onRun(pendingPlaybook)
      setPendingPlaybook(null)
    }
  }

  const handleCancelRun = () => {
    setPendingPlaybook(null)
  }

  // Focus input when editing starts
  useEffect(() => {
    if (editingPlaybookId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingPlaybookId])

  const handleStartRename = (playbook: PlaybookSummary) => {
    setEditingPlaybookId(playbook.id)
    setEditValue(playbook.name)
  }

  const handleSubmitRename = () => {
    if (editingPlaybookId && editValue.trim()) {
      onRename(editingPlaybookId, editValue.trim())
    }
    setEditingPlaybookId(null)
    setEditValue('')
  }

  const handleCancelRename = () => {
    setEditingPlaybookId(null)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (playbooks.length === 0) {
    return (
      <div className="px-2 text-xs text-muted-foreground">
        No playbooks yet. Ask in a session to "save this as a playbook".
      </div>
    )
  }

  return (
    <>
      <Dialog open={!!pendingPlaybook} onOpenChange={(open) => !open && handleCancelRun()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Run Playbook</DialogTitle>
            <DialogDescription>
              Do you want to run "{pendingPlaybook?.name || 'Untitled playbook'}"?
            </DialogDescription>
          </DialogHeader>
          {pendingPlaybook?.prompt && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
              {pendingPlaybook.prompt}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRun}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRun}>
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-1 overflow-hidden">
        {playbooks.map((playbook) => {
        const isEditing = editingPlaybookId === playbook.id

        return (
          <div
            key={playbook.id}
            className="group relative w-full"
          >
            <button
              type="button"
              onClick={() => !isEditing && handlePlaybookClick(playbook)}
              className={cn(
                'flex w-full overflow-hidden rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-transparent',
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
                      const name = playbook.name || 'Untitled playbook'
                      return name.length > 20 ? name.slice(0, 20) + '…' : name
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
                    <DropdownMenuItem onSelect={() => handlePlaybookClick(playbook)}>
                      <Play className="h-4 w-4" />
                      Run
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleStartRename(playbook)}>
                      <Pencil className="h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDelete(playbook.id)}
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
      </div>
    </>
  )
}
