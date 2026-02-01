import { useEffect, useState } from 'react'

/**
 * Fetch project ID from server config (cwd-based for SDK compatibility)
 */
export function useProjectConfig() {
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.projectId) {
          setProjectId(data.projectId)
        }
      })
      .catch(() => {})
  }, [])

  return { projectId }
}
