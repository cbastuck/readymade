import { useCallback, useEffect, useState } from "react";
import JSON5 from "json5";

/**
 * Inputs written for "Run with parameters", kept to be run again.
 *
 * Writing a payload is the effort; the same few — the happy path, the empty
 * list, the one that broke last week — are what a board is tried with over and
 * over. So they are kept, by name, per board: a test case belongs to the board
 * it tests, and another board's would only be noise in the list.
 *
 * On this device only, in `localStorage`. They are a person's way of trying a
 * board, not part of it, so the board document does not change and nobody the
 * board is given to receives them.
 *
 * What is kept is what was written, not what it parses to: JSON is kept as its
 * source, so loading one brings back the text with its unquoted keys and
 * comments rather than a reformatted copy.
 */
export type SavedPayload =
  | { name: string; mode: "fields"; template: { [key: string]: string } }
  | { name: string; mode: "text"; text: string }
  | { name: string; mode: "json"; json: string };

/** A board with no name yet still gets a list, shared by the unnamed. */
const storageKey = (boardName: string | undefined) =>
  `hkp-run-payloads-${boardName ?? ""}`;

function isSavedPayload(value: unknown): value is SavedPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const p = value as Record<string, unknown>;
  if (typeof p.name !== "string") {
    return false;
  }
  switch (p.mode) {
    case "fields":
      return !!p.template && typeof p.template === "object";
    case "text":
      return typeof p.text === "string";
    case "json":
      return typeof p.json === "string";
    default:
      return false;
  }
}

/**
 * What is kept for a board. Fails soft, to an empty list: a browser that keeps
 * no site data must still run the board, and an entry that does not read as a
 * payload is dropped rather than refusing the rest.
 */
export function readRunPayloads(boardName: string | undefined): SavedPayload[] {
  try {
    const stored = localStorage.getItem(storageKey(boardName));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isSavedPayload) : [];
  } catch {
    return [];
  }
}

function writeRunPayloads(
  boardName: string | undefined,
  payloads: SavedPayload[],
) {
  try {
    if (payloads.length === 0) {
      localStorage.removeItem(storageKey(boardName));
    } else {
      localStorage.setItem(storageKey(boardName), JSON.stringify(payloads));
    }
  } catch {
    // Not being able to keep a payload is not a reason to refuse to run it.
  }
}

/**
 * The board's saved payloads, sorted by name, with saving and forgetting.
 * Saving under a name already taken replaces that one: the name is how a
 * person finds it, so two by the same name would be one too many.
 */
export function useRunPayloads(boardName: string | undefined) {
  const [payloads, setPayloads] = useState<SavedPayload[]>(() =>
    readRunPayloads(boardName),
  );

  useEffect(() => setPayloads(readRunPayloads(boardName)), [boardName]);

  const update = useCallback(
    (change: (current: SavedPayload[]) => SavedPayload[]) => {
      const next = change(readRunPayloads(boardName)).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      writeRunPayloads(boardName, next);
      setPayloads(next);
    },
    [boardName],
  );

  const save = useCallback(
    (payload: SavedPayload) =>
      update((current) => [
        ...current.filter((p) => p.name !== payload.name),
        payload,
      ]),
    [update],
  );

  const remove = useCallback(
    (name: string) =>
      update((current) => current.filter((p) => p.name !== name)),
    [update],
  );

  return { payloads, save, remove };
}

/**
 * How a payload is written, not what it is.
 *
 * Fields build an object a name at a time, which is what most services read.
 * Text is the payload itself — a request body pasted from an API's reference
 * manual, a document, anything whose shape is not a flat map of names to
 * values. JSON is a value that is not an object of strings — a list of items
 * for an Iterator, numbers, nesting — parsed before it is sent. File is a
 * file itself — an image, a recording — sent as the `File`, the way a
 * facade's file-pick sends one.
 */
export type RunPayloadMode = "fields" | "text" | "json" | "file";

export type ParsedRunJson =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/**
 * The quotes macOS and iOS substitute while typing, straightened. A last
 * resort for when the text area's own opt-out is ignored: only tried once the
 * text as typed has failed to parse, so curly quotes inside strings of JSON
 * that already parses are left alone.
 */
const straightenQuotes = (text: string) =>
  text.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'");

/**
 * JSON5 rather than JSON: what people type by hand is a JS literal —
 * `[{type: 1}]`, single quotes, a trailing comma — and JSON5 reads that
 * without evaluating anything. Plain JSON is a subset, so it parses as before.
 */
export function parseRunJson(text: string): ParsedRunJson {
  try {
    return { ok: true, value: JSON5.parse(text) };
  } catch (error) {
    try {
      return { ok: true, value: JSON5.parse(straightenQuotes(text)) };
    } catch {
      return { ok: false, error: (error as Error).message };
    }
  }
}

const extension = (file: File) =>
  file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";

const JSON_EXTENSIONS = ["json", "json5"];
const TEXT_EXTENSIONS = [
  "txt",
  "md",
  "csv",
  "tsv",
  "xml",
  "yaml",
  "yml",
  "html",
  "js",
  "ts",
  "log",
];

export const isJsonFile = (file: File) =>
  file.type === "application/json" || JSON_EXTENSIONS.includes(extension(file));

/**
 * A file that can be opened in an editor: something to look at and change
 * before running — a request body, a list of test items. Anything else is the
 * payload as it is, and is sent untouched.
 */
export const isTextFile = (file: File) =>
  isJsonFile(file) ||
  file.type.startsWith("text/") ||
  TEXT_EXTENSIONS.includes(extension(file));

export const readFileText = (file: File) =>
  typeof file.text === "function"
    ? file.text()
    : new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
