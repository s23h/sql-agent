import type { WebSocket } from "ws";
import type {
  IClaudeAgentSDKClient,
  ISessionClient,
  OutcomingMessage,
  MessageAddedOutcomingMessage,
} from "@claude-agent-kit/server";

export interface TurnCompleteCallback {
  (info: { sessionId: string; lastMessageUuid: string }, ws: WebSocket): void;
}

export class WebSocketSessionClient implements ISessionClient {
  sessionId: string | undefined;
  sdkClient: IClaudeAgentSDKClient;
  webSocket: WebSocket;
  onTurnComplete?: TurnCompleteCallback;

  constructor(
    sdkClient: IClaudeAgentSDKClient,
    webSocket: WebSocket,
    sessionId?: string,
    onTurnComplete?: TurnCompleteCallback
  ) {
    this.sdkClient = sdkClient;
    this.webSocket = webSocket;
    this.sessionId = sessionId;
    this.onTurnComplete = onTurnComplete;
  }

  receiveSessionMessage(_event: string, message: OutcomingMessage): void {
    try {
      if (process.env.DEBUG?.includes("session-client")) {
        console.log(
          `[WebSocketSessionClient] sending ${message.type} for session ${message.sessionId ?? "unknown"}`,
        );
      }
      this.webSocket.send(JSON.stringify(message));

      // Check for turn completion (result message received)
      if (message.type === "message_added" && this.onTurnComplete) {
        const addedMessage = message as MessageAddedOutcomingMessage;
        const sdkMessage = addedMessage.message;

        // Result message indicates turn completion
        if (sdkMessage && (sdkMessage as { type?: string }).type === "result") {
          const uuid = (sdkMessage as { uuid?: string }).uuid;
          const sessionId = message.sessionId;

          if (uuid && sessionId) {
            // Call turn complete callback asynchronously
            Promise.resolve(this.onTurnComplete({ sessionId, lastMessageUuid: uuid }, this.webSocket))
              .catch((err) => console.error("[WebSocketSessionClient] Turn complete callback error:", err));
          }
        }
      }
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }
}
