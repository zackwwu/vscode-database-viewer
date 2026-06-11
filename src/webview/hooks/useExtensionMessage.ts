import { useCallback, useEffect, useRef } from "react";
import { ExtensionMessage, WebviewMessage, createRequestId } from "../../shared/messages";

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

const vscode = acquireVsCodeApi();

type ResponseHandler = (msg: ExtensionMessage) => void;

export function useExtensionMessage() {
  const handlers = useRef<Map<string, ResponseHandler>>(new Map());

  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      if ("requestId" in msg && msg.requestId) {
        const handler = handlers.current.get(msg.requestId);
        if (handler) {
          handler(msg);
          if (msg.type !== "loading") {
            handlers.current.delete(msg.requestId);
          }
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const sendRequest = useCallback(
    <T extends ExtensionMessage>(
      msg: Omit<WebviewMessage, "requestId">,
      onResponse: (msg: T) => void
    ): string => {
      const requestId = createRequestId();
      handlers.current.set(requestId, onResponse as ResponseHandler);
      vscode.postMessage({ ...msg, requestId });
      return requestId;
    },
    []
  );

  const cancelRequest = useCallback((requestId: string) => {
    handlers.current.delete(requestId);
  }, []);

  return { sendRequest, cancelRequest };
}
