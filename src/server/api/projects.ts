import { readFile, readdir, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface ProjectInfo {
  id: string
  name: string
  path: string
}

export async function collectProjects(): Promise<ProjectInfo[]> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) {
    return []
  }

  let rootEntries: Dirent[]
  try {
    rootEntries = await readdir(projectsRoot, { withFileTypes: true })
  } catch {
    return []
  }

  const projects: ProjectInfo[] = []

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    const projectDir = path.join(projectsRoot, entry.name)

    let candidateFiles: Dirent[]
    try {
      candidateFiles = await readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }

    const jsonlFiles = candidateFiles.filter(
      (file) => file.isFile() && file.name.toLowerCase().endsWith('.jsonl'),
    )

    if (jsonlFiles.length === 0) {
      continue
    }

    let latestFilePath: string | null = null
    let latestMtime = -Infinity

    for (const file of jsonlFiles) {
      const filePath = path.join(projectDir, file.name)

      let statsResult
      try {
        statsResult = await stat(filePath)
      } catch {
        continue
      }

      if (statsResult.mtimeMs > latestMtime) {
        latestMtime = statsResult.mtimeMs
        latestFilePath = filePath
      }
    }

    if (!latestFilePath) {
      continue
    }

    const firstLine = await readFirstJsonLineWithCwd(latestFilePath)
    if (!firstLine) {
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(firstLine)
    } catch {
      continue
    }

    const cwd = (parsed as { cwd?: unknown } | undefined)?.cwd
    if (typeof cwd !== 'string' || cwd.trim().length === 0) {
      continue
    }

    const name = path.basename(cwd)
    projects.push({ id: entry.name, name, path: cwd })
  }

  return projects
}

export function getProjectsRoot(): string | null {
  const homeDir = os.homedir()
  if (!homeDir || homeDir.trim().length === 0) {
    return null
  }

  return path.join(homeDir, '.claude', 'projects')
}

// Get the current project ID
// The SDK uses cwd-based project IDs, so we derive it the same way
export function getCurrentProjectId(): string {
  if (process.env.PROJECT_ID) {
    return process.env.PROJECT_ID
  }
  // Match how the SDK derives project ID from cwd (keeps leading dash)
  return process.cwd().replace(/\//g, '-')
}

async function readFirstJsonLineWithCwd(filePath: string): Promise<string | null> {
  let fileContent: string

  try {
    fileContent = await readFile(filePath, 'utf8')
  } catch {
    return null
  }

  if (fileContent.length === 0) {
    return null
  }

  // Split into lines and find first one with cwd property
  const lines = fileContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim().replace(/^\uFEFF/, '')
    if (trimmed.length === 0) {
      continue
    }

    try {
      const parsed = JSON.parse(trimmed) as { cwd?: unknown }
      if (typeof parsed.cwd === 'string' && parsed.cwd.trim().length > 0) {
        return trimmed
      }
    } catch {
      continue
    }
  }

  return null
}
