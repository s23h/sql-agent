import type { AttachedFile } from '@/components/prompt-input/prompt-input'
import type { AttachmentPayload } from '@claude-agent-kit/messages'

/**
 * Read a file as base64 encoded string
 */
export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'))
        return
      }
      const [, base64] = result.split(',', 2)
      if (!base64) {
        reject(new Error('Invalid data URI'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read file'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Convert attached files to attachment payloads for sending to server
 */
export async function buildAttachmentPayloads(
  attachments: AttachedFile[],
): Promise<AttachmentPayload[]> {
  const payloads: AttachmentPayload[] = []
  for (const { file } of attachments) {
    try {
      const data = await readFileAsBase64(file)
      payloads.push({
        name: file.name,
        mediaType: file.type || 'application/octet-stream',
        data,
      })
    } catch (error) {
      console.error('Failed to serialize attachment for upload:', error)
    }
  }
  return payloads
}
