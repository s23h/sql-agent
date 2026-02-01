export type Project = {
  id: string
  name: string
  path: string
}

export type ProjectWithActivity = Project & {
  latestActivity: number | null
}

export type SessionSummary = {
  id: string
  prompt: string
  firstMessageAt: number
  lastMessageAt: number
}

export type SessionSelectPayload = {
  sessionId: string
  projectId: string | null
}

export type PlaybookSummary = {
  id: string
  name: string
  prompt: string
  createdAt: string
  updatedAt: string
}

export type LeftSidebarProps = {
  selectedSessionId?: string | null
  onSessionSelect?: (payload: SessionSelectPayload) => void
  onProjectChange?: (projectId: string | null) => void
  onNewSession?: () => void
  userButton?: React.ReactNode
}
