import { useCallback, useEffect, useState } from "react";

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
