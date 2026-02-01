/**
 * Shared DuckDB CLI utility
 * Provides path resolution and caching for DuckDB CLI binary
 */

import { execSync } from 'child_process'
import path from 'path'
import os from 'os'

let cachedPath: string | null = null

/**
 * Find and cache the DuckDB CLI path
 * Checks common installation locations and falls back to PATH
 */
export function getDuckDBPath(): string {
  if (cachedPath) return cachedPath

  const candidates = [
    path.join(os.homedir(), '.duckdb/cli/latest/duckdb'),
    '/usr/local/bin/duckdb',
    '/usr/bin/duckdb',
    'duckdb',
  ]

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: 'pipe' })
      cachedPath = candidate
      return candidate
    } catch {
      continue
    }
  }

  throw new Error('DuckDB CLI not found. Install with: curl https://install.duckdb.org | sh')
}
