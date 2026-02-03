/**
 * Tool for AI-initiated worldline branching
 * Allows Claude to create branches via natural language
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

// Pending branch direction - set by tool, consumed by onTurnComplete
let pendingBranchDirection: string | null = null

export function setPendingBranchDirection(direction: string | null) {
  pendingBranchDirection = direction
}

export function getPendingBranchDirection(): string | null {
  return pendingBranchDirection
}

/**
 * Create the in-process MCP server with worldline branching tool
 */
export function createBranchMcpServer() {
  return createSdkMcpServer({
    name: 'worldlines',
    version: '1.0.0',
    tools: [
      tool(
        'create_worldline',
        `Create a new worldline (alternate timeline) to explore a different direction.
Use this when the user wants to branch off and explore something different without losing the current path.

CRITICAL: After calling this tool, you MUST immediately end your turn. Do NOT call any other tools. Do NOT perform the requested action yourself. The system will automatically:
1. Save the current state
2. Create the new worldline
3. Switch to it
4. Execute the new_direction in that fresh worldline

Your only job is to call this tool and then respond briefly to the user.`,
        {
          new_direction: z.string().describe('The prompt/direction to explore in the new worldline. This will become the first user message in the new worldline.'),
        },
        async ({ new_direction }) => {
          setPendingBranchDirection(new_direction)
          return {
            content: [{
              type: 'text' as const,
              text: `Worldline branch initiated for: "${new_direction}"

STOP HERE. Do NOT call any other tools. Do NOT perform "${new_direction}" yourself.
The system will automatically switch to the new worldline and execute it there.
Just respond briefly to confirm the branch is being created.`
            }]
          }
        }
      )
    ],
  })
}
