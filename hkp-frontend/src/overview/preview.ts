/**
 * A bounded rendering of a value flowing through a pipeline.
 *
 * Written to a budget rather than serialized and cut, because it runs on every
 * call every service takes: `JSON.stringify` of an audio buffer costs the whole
 * buffer before a single character is discarded, and a board pushing frames
 * would spend its time describing them. Walking to a budget costs what is
 * shown, whatever it was cut from.
 *
 * The result is a string, so nothing here keeps the value alive once the call
 * that carried it is over.
 */
const BUDGET = 400;
const MAX_DEPTH = 4;
/** How much of a long string is worth seeing before it repeats itself. */
const STRING_LIMIT = 120;
/** Enough of a numeric buffer to tell silence from signal. */
const SAMPLE_COUNT = 6;

export function previewValue(value: unknown): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();
  let used = 0;
  let truncated = false;

  const emit = (text: string): boolean => {
    if (used + text.length > BUDGET) {
      truncated = true;
      return false;
    }
    parts.push(text);
    used += text.length;
    return true;
  };

  const walk = (v: unknown, depth: number): boolean => {
    if (v === null) {
      return emit("null");
    }
    if (v === undefined) {
      return emit("undefined");
    }
    if (typeof v === "string") {
      const cut = v.length > STRING_LIMIT ? `${v.slice(0, STRING_LIMIT)}…` : v;
      return emit(JSON.stringify(cut));
    }
    if (typeof v === "number" || typeof v === "boolean") {
      return emit(String(v));
    }
    if (typeof v === "bigint") {
      return emit(`${v}n`);
    }
    if (typeof v === "function") {
      return emit("[function]");
    }
    if (typeof v === "symbol") {
      return emit(v.toString());
    }

    if (v instanceof ArrayBuffer) {
      return emit(`ArrayBuffer(${v.byteLength})`);
    }
    if (ArrayBuffer.isView(v)) {
      const view = v as unknown as {
        length: number;
        constructor: { name: string };
      };
      const head = Array.from(
        v as unknown as ArrayLike<number> as ArrayLike<number>,
      ).slice(0, SAMPLE_COUNT);
      const tail = view.length > SAMPLE_COUNT ? ", …" : "";
      return emit(
        `${view.constructor.name}(${view.length}) [${head.join(", ")}${tail}]`,
      );
    }

    if (depth >= MAX_DEPTH) {
      return emit("…");
    }
    if (seen.has(v as object)) {
      return emit("[circular]");
    }
    seen.add(v as object);

    if (Array.isArray(v)) {
      if (!emit("[")) {
        return false;
      }
      for (let i = 0; i < v.length; i += 1) {
        if (i > 0 && !emit(", ")) {
          return false;
        }
        if (!walk(v[i], depth + 1)) {
          return false;
        }
      }
      return emit("]");
    }

    const entries = Object.entries(v as Record<string, unknown>);
    if (!emit("{")) {
      return false;
    }
    for (let i = 0; i < entries.length; i += 1) {
      if (i > 0 && !emit(", ")) {
        return false;
      }
      if (!emit(`${entries[i][0]}: `)) {
        return false;
      }
      if (!walk(entries[i][1], depth + 1)) {
        return false;
      }
    }
    return emit("}");
  };

  walk(value, 0);
  return parts.join("") + (truncated ? " …" : "");
}
