/**
 * Playbook MCP tools - allows Claude to create and update playbooks
 */

import { randomUUID } from 'node:crypto'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { createPlaybook, listPlaybooks, updatePlaybook } from '../db/app-db'

// Track current user ID for the active session
let currentUserId: string | null = null

export function setCurrentPlaybookUser(userId: string | null) {
  currentUserId = userId
}

export function getCurrentPlaybookUser(): string | null {
  return currentUserId
}

/**
 * Create the in-process MCP server with playbook tools
 */
export function createPlaybookMcpServer() {
  return createSdkMcpServer({
    name: 'playbooks',
    version: '1.0.0',
    tools: [
      tool(
        'create_playbook',
        `Save the current conversation as a reusable playbook. Only use this to create NEW playbooks.

When the user asks to save/create a playbook:
- Generate a short descriptive name based on what was accomplished
- Summarize the user's original request as the prompt (what they wanted done)
- Only ask the user for a name if the conversation has no meaningful context yet

Do NOT use this tool to update existing playbooks - use update_playbook instead.`,
        {
          name: z.string().describe('Short name for the playbook (auto-generated from conversation)'),
          prompt: z.string().describe('The prompt/request to save (summarized from conversation)'),
        },
        async ({ name, prompt }) => {
          const userId = getCurrentPlaybookUser()
          if (!userId) {
            return { content: [{ type: 'text', text: 'Cannot create playbook: user not authenticated.' }], isError: true }
          }
          const id = randomUUID()
          await createPlaybook(id, userId, name, prompt)
          return { content: [{ type: 'text', text: `Playbook "${name}" created successfully! You can find it in the sidebar under Playbooks.` }] }
        }
      ),

      tool(
        'update_playbook',
        `Update an existing playbook's name or prompt.

Use this when the user wants to rename a playbook or change its saved prompt.
You must provide the current name to identify which playbook to update.`,
        {
          current_name: z.string().describe('The current name of the playbook to update'),
          new_name: z.string().optional().describe('New name for the playbook (optional)'),
          new_prompt: z.string().optional().describe('New prompt for the playbook (optional)'),
        },
        async ({ current_name, new_name, new_prompt }) => {
          const userId = getCurrentPlaybookUser()
          if (!userId) {
            return { content: [{ type: 'text', text: 'Cannot update playbook: user not authenticated.' }], isError: true }
          }

          // Find playbook by current name (only user's playbooks)
          const playbooks = await listPlaybooks(userId)
          const playbook = playbooks.find(p => p.name.toLowerCase() === current_name.toLowerCase())

          if (!playbook) {
            return { content: [{ type: 'text', text: `Playbook "${current_name}" not found. Available playbooks: ${playbooks.map(p => p.name).join(', ') || 'none'}` }], isError: true }
          }

          const updatedName = new_name || playbook.name
          const updatedPrompt = new_prompt || playbook.prompt

          await updatePlaybook(playbook.id, updatedName, updatedPrompt)
          return { content: [{ type: 'text', text: `Playbook updated! Name: "${updatedName}"` }] }
        }
      ),
    ],
  })
}
