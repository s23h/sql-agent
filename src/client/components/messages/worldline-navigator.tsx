import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface WorldlineBranch {
  sessionId: string
  parentSessionId: string | null  // Parent session ID (null for root session)
  branchPointMessageUuid: string
  branchPointParentUuid?: string  // The message BEFORE the branch point (exists in BOTH sessions)
  createdAt: number
  lastModifiedAt: number  // Used to determine which branch to show by default
}

interface WorldlineNavigatorProps {
  branches: WorldlineBranch[]
  currentSessionId: string
  onNavigate: (sessionId: string) => void
}

export function WorldlineNavigator({
  branches,
  currentSessionId,
  onNavigate,
}: WorldlineNavigatorProps) {
  if (branches.length <= 1) {
    return null
  }

  const currentIndex = branches.findIndex((b) => b.sessionId === currentSessionId)
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 1
  const total = branches.length

  const handlePrev = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : branches.length - 1
    onNavigate(branches[prevIndex].sessionId)
  }

  const handleNext = () => {
    const nextIndex = currentIndex < branches.length - 1 ? currentIndex + 1 : 0
    onNavigate(branches[nextIndex].sessionId)
  }

  return (
    <div
      className="worldline-navigator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 4px',
        background: 'rgba(4, 122, 85, 0.08)',
        border: '1px solid rgba(4, 122, 85, 0.2)',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#047A55',
        fontWeight: 500,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <button
        onClick={handlePrev}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'inherit',
          borderRadius: '2px',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(4, 122, 85, 0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Previous worldline"
      >
        <ChevronLeft size={12} />
      </button>
      <span style={{ minWidth: '24px', textAlign: 'center', letterSpacing: '-0.5px' }}>
        {displayIndex}/{total}
      </span>
      <button
        onClick={handleNext}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'inherit',
          borderRadius: '2px',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(4, 122, 85, 0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Next worldline"
      >
        <ChevronRight size={12} />
      </button>
    </div>
  )
}
