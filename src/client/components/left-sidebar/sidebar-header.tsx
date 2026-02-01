import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type SidebarHeaderProps = {
  onNewSession?: () => void
  disabled: boolean
  projectName: string | null
  latestActivity: number | null
}

export function SidebarHeader({
  onNewSession,
  disabled,
}: SidebarHeaderProps) {
  return (
    <div className="flex flex-col">
      {/* New Session button */}
      <div className="border-b px-3 py-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-none border"
          onClick={onNewSession}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>
    </div>
  )
}

type SectionHeaderProps = {
  title: string
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="px-1 py-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {title}
      </p>
    </div>
  )
}
