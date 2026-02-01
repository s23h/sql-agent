import type { WebSocket } from "ws";
import {
  SessionManager,
  type BranchSessionIncomingMessage,
  type BranchResult,
  type ChatIncomingMessage,
  type IClaudeAgentSDKClient,
  type IncomingMessage,
  type ResumeSessionIncomingMessage,
  type SessionSDKOptions,
  type SetSDKOptionsIncomingMessage,
} from "@claude-agent-kit/server";
import { WebSocketSessionClient } from "./websocket-session-client";

export interface TurnCompleteInfo {
  sessionId: string;
  lastMessageUuid: string;
}

export interface WorldlineSibling {
  sessionId: string;
  parentSessionId: string | null;
  branchPointMessageUuid: string;
  branchPointParentUuid?: string;
  createdAt: number;
  lastModifiedAt: number;
}

export interface WebSocketHandlerOptions extends SessionSDKOptions {
  /**
   * Optional callback called after a branch is created successfully.
   * This is called BEFORE the "branched" event is sent to the client.
   * Use this to save branch metadata server-side to avoid race conditions.
   */
  onBranchComplete?: (branchResult: BranchResult, ws: WebSocket) => Promise<void> | void;

  /**
   * Optional callback called when an assistant turn completes (result message received).
   * Use this to create sandbox snapshots for worldline support.
   */
  onTurnComplete?: (info: TurnCompleteInfo, ws: WebSocket) => Promise<void> | void;

  /**
   * Optional callback to get worldline siblings for a session.
   * Used to include worldlines in the 'branched' response to avoid race conditions.
   */
  getWorldlines?: (sessionId: string) => Promise<WorldlineSibling[]>;
}

export class WebSocketHandler {
  private clients: Map<WebSocket, WebSocketSessionClient> = new Map();
  private sessionManager = new SessionManager();

  sdkClient: IClaudeAgentSDKClient;
  options: WebSocketHandlerOptions;

  constructor(sdkClient: IClaudeAgentSDKClient, options: WebSocketHandlerOptions) {
    this.sdkClient = sdkClient;
    this.options = options;
  }

  private send(ws: WebSocket, payload: Record<string, unknown>): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }

  public async onOpen(ws: WebSocket) {
    // Create turn complete callback that wraps the options callback
    const turnCompleteCallback = this.options.onTurnComplete
      ? (info: { sessionId: string; lastMessageUuid: string }, websocket: WebSocket) => {
          this.options.onTurnComplete?.(info, websocket);
        }
      : undefined;

    const client = new WebSocketSessionClient(this.sdkClient, ws, undefined, turnCompleteCallback);
    this.clients.set(ws, client);
    console.log('WebSocket client connected:', client.sessionId);
    this.sessionManager.subscribe(client);

    this.send(ws, { type: "connected", message: 'Connected to Agent Data.' });
  }

  public onClose(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered on close");
      return;
    }
    console.log('WebSocket client disconnected:', client.sessionId);
    this.sessionManager.unsubscribe(client);
    this.clients.delete(ws);
  }

  public async onMessage(ws: WebSocket, rawMessage: string): Promise<void> {
    let message: IncomingMessage;
    try {
      message = JSON.parse(rawMessage) as IncomingMessage;
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
      this.send(ws, { type: "error", error: "Invalid JSON payload" });
      return;
    }

    switch (message.type) {
      case "chat":
        await this.handleChatMessage(ws, message);
        break;
      case "setSDKOptions":
        this.handleSetSDKOptions(ws, message);
        break;
      case "resume":
        await this.handleResumeMessage(ws, message);
        break;
      case "branch":
        await this.handleBranchMessage(ws, message);
        break;
      case "interrupt":
        this.handleInterruptMessage(ws);
        break;
      default:
        this.send(ws, {
          type: "error",
          error: `Unsupported message type: ${String((message as { type?: unknown }).type)}`,
          code: "unsupported_message_type",
        });
        break;
    }

  }

  
  private handleSetSDKOptions(ws: WebSocket, message: SetSDKOptionsIncomingMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    try {
      this.sessionManager.setSDKOptions(client, message.options);
    } catch (error) {
      console.error("Failed to set SDK options:", error);
      this.send(ws, { type: "error", error: "Failed to set SDK options" });
    }
  }

  private async handleChatMessage(ws: WebSocket, message: ChatIncomingMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      return;
    }

    const content = message.content?.trim();
    if (!content) {
      this.send(ws, {
        type: "error",
        error: "Message content cannot be empty",
        code: "empty_message",
      });
      return;
    }

    this.sessionManager.sendMessage(client, content, message.attachments);
  }

  private async handleResumeMessage(ws: WebSocket, message: ResumeSessionIncomingMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    const targetSessionId = message.sessionId?.trim();
    console.log(`[WebSocketHandler] Client ${client.sessionId ?? "unknown"} requested resume to ${targetSessionId}`, message);
    if (!targetSessionId) {
      this.send(ws, {
        type: "error",
        error: "Session ID is required to resume",
        code: "invalid_session_id",
      });
      return;
    }

    const previousSessionId = client.sessionId;
    if (previousSessionId && previousSessionId !== targetSessionId) {
      const previousSession = this.sessionManager.getSession(previousSessionId);
      previousSession?.unsubscribe(client);
      console.log(`[WebSocketHandler] Unsubscribed client from previous session ${previousSessionId}`);
    }

    client.sessionId = targetSessionId;

    const session = this.sessionManager.getOrCreateSession(client);
    session.subscribe(client);
    client.sessionId = targetSessionId;
    console.log(`[WebSocketHandler] Client subscribed to ${targetSessionId}, session has ${session.messages.length} messages loaded`);

    try {
      await session.resumeFrom(targetSessionId);
      console.log(`[WebSocketHandler] Resume completed for ${targetSessionId}`);
    } catch (error) {
      console.error(`Failed to resume session '${targetSessionId}':`, error);
      this.send(ws, {
        type: "error",
        error: "Failed to resume session",
        code: "resume_failed",
      });
    }
  }

  private async handleBranchMessage(ws: WebSocket, message: BranchSessionIncomingMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    const { sourceSessionId, branchAtMessageUuid, content, attachments } = message;

    if (!sourceSessionId?.trim()) {
      this.send(ws, {
        type: "error",
        error: "Source session ID is required for branching",
        code: "invalid_source_session",
      });
      return;
    }

    if (!branchAtMessageUuid?.trim()) {
      this.send(ws, {
        type: "error",
        error: "Branch point message UUID is required",
        code: "invalid_branch_point",
      });
      return;
    }

    if (!content?.trim()) {
      this.send(ws, {
        type: "error",
        error: "Message content is required for branching",
        code: "empty_message",
      });
      return;
    }

    console.log(`[WebSocketHandler] Branching from session ${sourceSessionId} at message ${branchAtMessageUuid}`);

    // Unsubscribe from previous session if any
    const previousSessionId = client.sessionId;
    if (previousSessionId) {
      const previousSession = this.sessionManager.getSession(previousSessionId);
      previousSession?.unsubscribe(client);
    }

    // Clear the client's session ID so a new session is created
    client.sessionId = undefined;

    // Get or create a new session for this branch
    const session = this.sessionManager.getOrCreateSession(client);
    session.subscribe(client);

    try {
      // Execute the branch
      const branchResult = await session.branch(sourceSessionId, branchAtMessageUuid, content.trim(), attachments);

      // Call the onBranchComplete callback BEFORE sending the event to the client
      // This ensures branch metadata is saved before the sidebar could refresh
      if (this.options.onBranchComplete && branchResult.newSessionId) {
        try {
          await this.options.onBranchComplete(branchResult, ws);
        } catch (callbackError) {
          console.error(`[WebSocketHandler] onBranchComplete callback failed:`, callbackError);
          // Continue even if callback fails - the branch was successful
        }
      }

      // Fetch worldlines to include in the response (avoids race condition on client)
      let worldlines: WorldlineSibling[] = [];
      if (this.options.getWorldlines && session.sessionId) {
        try {
          worldlines = await this.options.getWorldlines(session.sessionId);
        } catch (e) {
          // Worldlines are optional, don't fail the branch
          console.error(`[WebSocketHandler] getWorldlines failed:`, e);
        }
      }

      // Notify client of the new session ID with worldlines included
      this.send(ws, {
        type: "branched",
        sourceSessionId,
        branchAtMessageUuid,
        newSessionId: session.sessionId,
        worldlines,
      });

      console.log(`[WebSocketHandler] Branch completed, new session: ${session.sessionId}`);
    } catch (error) {
      console.error(`Failed to branch from session '${sourceSessionId}':`, error);
      this.send(ws, {
        type: "error",
        error: "Failed to branch session",
        code: "branch_failed",
      });
    }
  }

  private handleInterruptMessage(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      return;
    }

    console.log(`[WebSocketHandler] Interrupt requested for session ${client.sessionId}`);
    this.sessionManager.interrupt(client);
    this.send(ws, { type: "interrupted" });
  }
}
