import { isTooLarge, TooLarge } from "hkp-frontend/src/runtime/callReport";

/**
 * What the flow inspector keeps of a service's calls, and how it reads the
 * reports they arrive in — the part of it that is not a frame.
 *
 * The desktop keeps it per service frame (`ServiceFrame`), the mobile canvas
 * for the whole board (`views/playground/mobile/boardFlow`); both read a
 * report here, so the two never disagree about what a call carried.
 */

/** One value a service received or produced, and when (ms since epoch). */
export type FlowRecord = { data: any; at: number };

/** Which way through the service a value went. */
export type FlowSide = "input" | "output";

const MAX_HISTORY = 10;

// Typed Data objects (FloatRingBuffer etc.) carry a Symbol tag, which
// structuredClone rejects with DataCloneError — keep the reference instead.
function safeClone(data: any): any {
  try {
    return structuredClone(data);
  } catch (_err) {
    return data;
  }
}

/**
 * `history` with `data` as its newest value, arrived `at`, keeping the last
 * MAX_HISTORY.
 *
 * Meant for a functional state update where each value arrives: values
 * reported in quick succession — an Iterator's items — are rendered once, so
 * a history built from a prop's changes would keep only the last of them.
 */
export function rememberFlow(
  history: FlowRecord[],
  data: any,
  at: number = Date.now(),
): FlowRecord[] {
  return [{ data: safeClone(data), at }, ...history].slice(0, MAX_HISTORY);
}

/** What one of the pair of reports bracketing a call says about it. */
export type CallReading =
  | {
      phase: "start";
      /** Which call, where the runtime numbers them (`processingSweep`). */
      call?: number;
      /** What it was called with, when that is a value worth keeping. */
      input?: { data: any };
    }
  | {
      phase: "finish";
      call?: number;
      /** What it passed on, when the report carried it and it was something. */
      output?: { data: any };
      /** Whether the call passed nothing on: the plug does not light. */
      stopped: boolean;
    };

/**
 * Reads a service's notification as a call report, or null for any other
 * notification.
 *
 * A service emitting on its own was called with nothing (null), and hkp-rt says
 * "<undefined>" for a call that carried no value: neither is an input to keep.
 * Nor is a report without Capture mode, which carries no value at all — it says
 * only whether the call passed anything on (`stopped`).
 */
export function readCallReport(notification: any): CallReading | null {
  const internal = notification?.__internal;
  if (internal === undefined || internal === null) {
    return null;
  }
  const { state, data, call } = internal;
  switch (state) {
    case "call-process": {
      const kept =
        "data" in internal && data != null && data !== "<undefined>";
      return { phase: "start", call, ...(kept ? { input: { data } } : {}) };
    }
    case "call-process-finished": {
      const carried = "data" in internal;
      const stopped = carried ? data === null : internal.stopped === true;
      return {
        phase: "finish",
        call,
        stopped,
        ...(carried && data !== null ? { output: { data } } : {}),
      };
    }
  }
  return null;
}

/**
 * What the inspector runs for a value shown in its editor: the value as it
 * arrived, or — once edited — what the edit says, as JSON where it is JSON.
 */
export function editedValue(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** When a value arrived, to the millisecond: a burst's items differ there. */
export function timeOf(at: number): string {
  const date = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

/** What a value too large to keep is, e.g. "Text of 12.3 MiB". */
export function describeTooLarge({
  type,
  bytes,
  exact,
}: TooLarge["__hkpTooLarge"]): string {
  const kind =
    type === "string" ? "Text" : type === "binary" ? "Binary data" : "JSON";
  return `${kind} of ${exact ? "" : "more than "}${sizeOf(bytes)}`;
}

/** Why the inspector shows only part of a value, and what it cannot do. */
export function tooLargeNote(
  tooLarge: TooLarge["__hkpTooLarge"],
  side: FlowSide,
): string {
  const shown =
    tooLarge.preview !== undefined
      ? "Only how it begins is shown"
      : "None of it is shown";
  const run = side === "input" ? "run again" : "carried on";
  return `${describeTooLarge(tooLarge)}: too large to keep whole. ${shown}, and it cannot be ${run} from here.`;
}

/** A size in bytes the way a person reads one. */
function sizeOf(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KiB`;
  }
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
}

/** One line of what a value is; the editor shows the whole of it. */
export function previewFlow(data: any): string {
  if (isTooLarge(data)) {
    return `${describeTooLarge(data.__hkpTooLarge)}, too large to keep`;
  }
  let text: string | undefined;
  try {
    // A sample buffer is named by its size rather than spelled out.
    text = JSON.stringify(data, (_key, value) =>
      ArrayBuffer.isView(value)
        ? `${value.constructor.name}(${(value as unknown as ArrayLike<unknown>).length ?? value.byteLength})`
        : value,
    );
  } catch {
    // Not serialisable; its plain text below says what it is.
  }
  text ??= String(data);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

/** A value as the inspector's editor shows it. */
export function flowText(data: any): string {
  return isTooLarge(data)
    ? (data.__hkpTooLarge.preview ?? "")
    : (JSON.stringify(data, null, 2) ?? "");
}
