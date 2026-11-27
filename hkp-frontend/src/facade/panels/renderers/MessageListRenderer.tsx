import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { MessageListWidget } from "../../types";
import { findService } from "../../boardServices";
import { useResolvedService } from "../../serviceNotifications";
import { extractText, resolvePath } from "../../readValue";
import { useWidgetActions } from "../../useWidgetActions";
import {
  isUserRef,
  resolveUserRef,
  useFacadeIdentity,
} from "../../FacadeIdentity";
import { WidgetRendererProps } from "../widgetRegistry";
import { serviceForUserInterface } from "hkp-frontend/src/types";

export type ChatMessage = {
  id: string;
  text: string;
  direction: "sent" | "received";
  author?: string;
  time?: string;
  // Sent from here and not yet in the thread the source last said.
  pending?: boolean;
};

/** How long a message sent from here is shown before the thread holds it. */
const PENDING_MS = 10_000;

function applyInput(template: unknown, input: string): unknown {
  if (typeof template === "string") {
    return template.replace("$$input", input);
  }
  return template;
}

function printable(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/**
 * A thread as the source says it — one message per row, oldest first — read
 * through the widget's field names.
 */
export function readThread(
  rows: unknown[],
  widget: Pick<
    MessageListWidget,
    "textField" | "authorField" | "timeField" | "idField" | "mineWhen"
  >,
  mine: string | undefined,
): ChatMessage[] {
  const textField = widget.textField ?? "text";
  const authorField = widget.authorField ?? "author";
  const timeField = widget.timeField ?? "time";
  const idField = widget.idField ?? "id";
  const messages: ChatMessage[] = [];
  rows.forEach((row, index) => {
    if (typeof row === "string") {
      messages.push({ id: `#${index}`, text: row, direction: "received" });
      return;
    }
    if (!row || typeof row !== "object") {
      return;
    }
    const text = printable(resolvePath(row, textField));
    if (text === undefined) {
      return;
    }
    const id = printable(resolvePath(row, idField)) ?? `#${index}`;
    const own =
      !!widget.mineWhen &&
      mine !== undefined &&
      printable(resolvePath(row, widget.mineWhen.field)) === mine;
    messages.push({
      id,
      text,
      direction: own ? "sent" : "received",
      author: printable(resolvePath(row, authorField)),
      time: printable(resolvePath(row, timeField)),
    });
  });
  return messages;
}

/**
 * What a new thread leaves of the messages sent from here: those it does not
 * hold yet, until they have waited long enough to have been refused.
 */
export function stillPending(
  pending: ChatMessage[],
  thread: ChatMessage[],
  sentAt: Map<string, number>,
  now: number,
): ChatMessage[] {
  const recent = new Set(thread.slice(-50).map((m) => m.text));
  return pending.filter(
    (m) => !recent.has(m.text) && now - (sentAt.get(m.id) ?? 0) < PENDING_MS,
  );
}

/** Whether a message starts a run: the first of its author's in a row. */
function opensRun(messages: ChatMessage[], index: number): boolean {
  const m = messages[index];
  const before = messages[index - 1];
  return (
    !before ||
    before.direction !== m.direction ||
    (before.author ?? "") !== (m.author ?? "")
  );
}

export function MessageListRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<MessageListWidget>) {
  // Kept apart: what the source said, and what was sent from here that the
  // source has not said back yet. Drawn one after the other.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const pendingRef = useRef<ChatMessage[]>([]);
  pendingRef.current = pending;
  const sentAt = useRef<Map<string, number>>(new Map());
  // Once the source has said a whole thread, it is a thread: what is sent from
  // here waits for it rather than being added for good.
  const threaded = useRef(false);
  const pendingEchoes = useRef<Map<string, number>>(new Map());
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastSeen = useRef<string | undefined>(undefined);
  const [composerValue, setComposerValue] = useState("");

  const identity = useFacadeIdentity(boardContext);
  const mine = useMemo(() => {
    const equals = widget.mineWhen?.equals;
    if (equals === undefined) {
      return undefined;
    }
    return isUserRef(equals) ? resolveUserRef(equals, identity) : equals;
  }, [widget.mineWhen?.equals, identity]);

  // Polled for rather than looked up once: a service inside a sub-service is
  // built after the facade first draws.
  const sourceService = useResolvedService(
    boardContext,
    widget.source.serviceUuid,
  );

  const legacyAction = widget.composer?.actions
    ? undefined
    : widget.composer?.action;
  const actionService = useMemo(
    () =>
      legacyAction
        ? serviceForUserInterface(
            findService(boardContext, legacyAction.serviceUuid),
          )
        : null,
    [boardContext, legacyAction],
  );
  const { run, prompt } = useWidgetActions(boardContext);

  const {
    textField,
    authorField,
    timeField,
    idField,
    mineWhen,
  } = widget;
  useEffect(() => {
    if (!sourceService?.app) {
      return;
    }
    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      const said = widget.source.path
        ? resolvePath(notification, widget.source.path)
        : notification;
      if (Array.isArray(said)) {
        threaded.current = true;
        const thread = readThread(
          said,
          { textField, authorField, timeField, idField, mineWhen },
          mine,
        );
        setMessages(thread);
        setPending(
          stillPending(pendingRef.current, thread, sentAt.current, Date.now()),
        );
        return;
      }
      const text = extractText(notification, widget.source.path);
      if (!text) {
        return;
      }
      const echoExp = pendingEchoes.current.get(text);
      if (echoExp !== undefined) {
        pendingEchoes.current.delete(text);
        if (Date.now() < echoExp) {
          return;
        }
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
  }, [
    sourceService,
    widget.source.path,
    textField,
    authorField,
    timeField,
    idField,
    mineWhen,
    mine,
  ]);

  const shown = useMemo(() => [...messages, ...pending], [messages, pending]);

  // Follows the thread down when something new arrives — unless the reader has
  // scrolled up to read, which a thread said again unchanged must not undo.
  useEffect(() => {
    const last = shown[shown.length - 1];
    const key = last ? `${last.id}\u0000${shown.length}` : undefined;
    if (key === lastSeen.current) {
      return;
    }
    const first = lastSeen.current === undefined;
    lastSeen.current = key;
    const el = scroller.current;
    if (el && (first || atBottom.current || last?.pending)) {
      if (typeof el.scrollTo === "function") {
        el.scrollTo({ top: el.scrollHeight, behavior: first ? "auto" : "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [shown]);

  const { markBoardChanged } = boardContext;
  const handleSend = useCallback(
    (text: string) => {
      const composer = widget.composer;
      if (!composer) {
        return;
      }
      const sent: ChatMessage = { id: uuidv4(), text, direction: "sent" };
      if (threaded.current) {
        sentAt.current.set(sent.id, Date.now());
        setPending((prev) => [...prev, { ...sent, pending: true }]);
        // Gone by itself if the thread never comes back with it — refused,
        // say, which a notice on the service is there to explain.
        setTimeout(() => {
          setPending((prev) => prev.filter((m) => m.id !== sent.id));
          sentAt.current.delete(sent.id);
        }, PENDING_MS);
      } else {
        pendingEchoes.current.set(text, Date.now() + 5000);
        setMessages((prev) => [...prev, sent]);
      }
      if (composer.actions) {
        void run({ actions: composer.actions, value: text });
        return;
      }
      if (!actionService || !composer.action) {
        return;
      }
      const configure: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(composer.action.configure ?? {})) {
        configure[k] = applyInput(v, text);
      }
      actionService.configure(configure);
      markBoardChanged?.();
    },
    [actionService, widget.composer, markBoardChanged, run],
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
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {shown.length === 0 && (
          <div
            style={{
              margin: "auto",
              color: "hsl(var(--muted-foreground))",
              fontSize: 13,
              textAlign: "center",
              whiteSpace: "pre-line",
            }}
          >
            {widget.placeholder ??
              "No messages yet.\nOpen this board in another browser window to chat."}
          </div>
        )}
        {shown.map((m, index) => {
          const isSent = m.direction === "sent";
          const opens = opensRun(shown, index);
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isSent ? "flex-end" : "flex-start",
                marginTop: opens && index > 0 ? 10 : 0,
              }}
            >
              {opens && !isSent && m.author && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "hsl(var(--muted-foreground))",
                    margin: "0 0 2px 12px",
                  }}
                >
                  {m.author}
                </div>
              )}
              <div
                title={m.time}
                style={{
                  maxWidth: "75%",
                  padding: "7px 12px",
                  borderRadius: isSent
                    ? "16px 16px 4px 16px"
                    : "16px 16px 16px 4px",
                  background: isSent
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                  color: isSent
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))",
                  opacity: m.pending ? 0.6 : 1,
                  fontSize: 14,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text}
                {(m.time || m.pending) && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      opacity: 0.7,
                      float: "right",
                      marginTop: 4,
                    }}
                  >
                    {m.pending ? "sending…" : m.time}
                  </span>
                )}
              </div>
            </div>
          );
        })}
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
            aria-label={widget.composer.placeholder ?? "Message"}
            style={{
              flex: 1,
              minWidth: 0,
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
      {prompt}
    </div>
  );
}
