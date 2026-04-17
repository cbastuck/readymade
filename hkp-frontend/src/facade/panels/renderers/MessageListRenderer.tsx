import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { MessageListWidget } from "../../types";
import { findService, extractText } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

type ChatMessage = {
  id: string;
  text: string;
  direction: "sent" | "received";
};

function applyInput(template: unknown, input: string): unknown {
  if (typeof template === "string") {
    return template.replace("$$input", input);
  }
  return template;
}

export function MessageListRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<MessageListWidget>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const pendingEchoes = useRef<Map<string, number>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const [composerValue, setComposerValue] = useState("");

  const sourceService = useMemo(
    () => findService(boardContext, widget.source.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.source.serviceUuid],
  );

  const actionService = useMemo(
    () =>
      widget.composer
        ? findService(boardContext, widget.composer.action.serviceUuid)
        : null,
    [boardContext.scopes, boardContext.services, widget.composer?.action.serviceUuid],
  );

  useEffect(() => {
    if (!sourceService?.app) {
      return;
    }
    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      const text = extractText(notification, widget.source.path);
      if (!text) {
        return;
      }
      const echoExp = pendingEchoes.current.get(text);
      if (echoExp !== undefined) {
        if (Date.now() < echoExp) {
          pendingEchoes.current.delete(text);
          return;
        }
        pendingEchoes.current.delete(text);
      }
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text, direction: "received" },
      ]);
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, widget.source.path]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!actionService || !widget.composer) {
        return;
      }
      const configure: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(widget.composer.action.configure)) {
        configure[k] = applyInput(v, text);
      }
      pendingEchoes.current.set(text, Date.now() + 5000);
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text, direction: "sent" },
      ]);
      actionService.configure(configure);
    },
    [actionService, widget.composer],
  );

  const submitComposer = useCallback(() => {
    const text = composerValue.trim();
    if (!text) {
      return;
    }
    setComposerValue("");
    handleSend(text);
  }, [composerValue, handleSend]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              margin: "auto",
              color: "hsl(var(--muted-foreground))",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No messages yet.
            <br />
            Open this board in another browser window to chat.
          </div>
        )}
        {messages.map((m) => {
          const isSent = m.direction === "sent";
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: isSent ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  padding: "8px 14px",
                  borderRadius: isSent
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                  background: isSent
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                  color: isSent
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))",
                  fontSize: 14,
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {widget.composer && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
            flexShrink: 0,
          }}
        >
          <input
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitComposer();
              }
            }}
            placeholder={widget.composer.placeholder ?? "Type a message…"}
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: 22,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--muted))",
              color: "hsl(var(--foreground))",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={submitComposer}
            style={{
              padding: "9px 18px",
              borderRadius: 22,
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {widget.composer.submitLabel ?? "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
