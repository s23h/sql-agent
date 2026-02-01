import { Router } from 'express'
import { sandboxManager } from '../sandbox/e2b-manager'

const router = Router()

// List all sandboxes
router.get('/sandboxes', async (_req, res) => {
  try {
    const sandboxes = sandboxManager.listSandboxes()
    res.json(sandboxes)
  } catch {
    res.json([])
  }
})

// Create a new sandbox
router.post('/sandboxes', async (_req, res) => {
  try {
    const sandboxId = await sandboxManager.createSandbox()
    res.json({ id: sandboxId, status: 'running' })
  } catch {
    res.status(500).json({ error: 'Failed to create sandbox' })
  }
})

// List files in a sandbox
router.get('/sandboxes/:id/files', async (req, res) => {
  const { id } = req.params
  const path = (req.query.path as string) || '/home/user'

  try {
    const files = await sandboxManager.listFiles(id, path)
    res.json(files)
  } catch {
    res.json([])
  }
})

// Get file content
router.get('/sandboxes/:id/files/content', async (req, res) => {
  const { id } = req.params
  const filePath = req.query.path as string

  if (!filePath) {
    res.status(400).json({ error: 'path query parameter required' })
    return
  }

  try {
    const { content, encoding } = await sandboxManager.readFile(id, filePath)
    res.json({ content, encoding })
  } catch {
    res.status(500).json({ error: 'Failed to read file' })
  }
})

// Get MIME type from file extension
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const mimeTypes: Record<string, string> = {
    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    // Documents
    pdf: 'application/pdf',
    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    // Text
    txt: 'text/plain',
    json: 'application/json',
    js: 'text/javascript',
    ts: 'text/typescript',
    py: 'text/x-python',
    html: 'text/html',
    css: 'text/css',
    md: 'text/markdown',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Download file (returns raw content for saving)
router.get('/sandboxes/:id/download', async (req, res) => {
  const { id } = req.params
  const filePath = req.query.path as string

  if (!filePath) {
    res.status(400).json({ error: 'path query parameter required' })
    return
  }

  try {
    const fileName = filePath.split('/').pop() || 'download'
    const { content, encoding } = await sandboxManager.readFile(id, filePath)
    const mimeType = getMimeType(fileName)

    if (encoding === 'base64') {
      const buffer = Buffer.from(content, 'base64')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Content-Length', buffer.length)
      res.send(buffer)
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      res.setHeader('Content-Type', mimeType)
      res.send(content)
    }
  } catch {
    res.status(500).json({ error: 'Failed to download file' })
  }
})

// Execute code in sandbox
router.post('/sandboxes/:id/execute', async (req, res) => {
  const { id } = req.params
  const { code, language = 'python' } = req.body

  if (!code) {
    res.status(400).json({ error: 'code field required' })
    return
  }

  try {
    const result = await sandboxManager.executeCode(id, code, language)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Failed to execute code' })
  }
})

// Execute command in sandbox
router.post('/sandboxes/:id/command', async (req, res) => {
  const { id } = req.params
  const { command } = req.body

  if (!command) {
    res.status(400).json({ error: 'command field required' })
    return
  }

  try {
    const result = await sandboxManager.executeCommand(id, command)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Failed to execute command' })
  }
})

// Pause sandbox (for state snapshots)
router.post('/sandboxes/:id/pause', async (req, res) => {
  const { id } = req.params

  try {
    const pausedId = await sandboxManager.pauseSandbox(id)
    res.json({ pausedId })
  } catch {
    res.status(500).json({ error: 'Failed to pause sandbox' })
  }
})

// Resume sandbox
router.post('/sandboxes/:id/resume', async (req, res) => {
  const { id } = req.params

  try {
    await sandboxManager.resumeSandbox(id)
    res.json({ status: 'running' })
  } catch {
    res.status(500).json({ error: 'Failed to resume sandbox' })
  }
})

// Kill sandbox
router.delete('/sandboxes/:id', async (req, res) => {
  const { id } = req.params

  try {
    await sandboxManager.killSandbox(id)
    res.json({ status: 'killed' })
  } catch {
    res.status(500).json({ error: 'Failed to kill sandbox' })
  }
})

export default router
