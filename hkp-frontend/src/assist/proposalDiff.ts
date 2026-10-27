import { BoardDescriptor } from "../types";

/**
 * A proposal compared with the board it would replace, in the two forms a
 * person reads one in: what it does, said in words, and the document's lines.
 * The desktop's preview shows the lines in an editor; a phone, without room
 * for two columns of JSON, leads with the words.
 */

// Object property order has no meaning in board JSON; array order is wiring.
// Keep the real values (including runtime state) while avoiding noisy diffs
// caused by the model writing the same properties in a different order.
export function sortedJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJSON);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortedJSON(record[key])]),
  );
}

/** A board as its diff shows it: sorted, indented, one value per line. */
export function boardText(board: BoardDescriptor): string {
  return JSON.stringify(sortedJSON(board), null, 2);
}

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/**
 * Past this many cells the changed middle is shown as removed, then added,
 * rather than aligned: a phone would spend seconds on a table this large, and
 * a rewrite that big reads no better aligned.
 */
const MAX_CELLS = 4_000_000;

/** The lines of `after` against those of `before`, aligned where they agree. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const same = (text: string): DiffLine => ({ kind: "same", text });
  const middle: DiffLine[] = [];
  const n = endA - start;
  const m = endB - start;
  if (n * m > MAX_CELLS) {
    for (let i = start; i < endA; i++) middle.push({ kind: "removed", text: a[i] });
    for (let j = start; j < endB; j++) middle.push({ kind: "added", text: b[j] });
  } else {
    // The longest common subsequence, from the end, so the walk below runs
    // forwards.
    const lcs = new Uint32Array((n + 1) * (m + 1));
    const at = (i: number, j: number) => i * (m + 1) + j;
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[at(i, j)] =
          a[start + i] === b[start + j]
            ? lcs[at(i + 1, j + 1)] + 1
            : Math.max(lcs[at(i + 1, j)], lcs[at(i, j + 1)]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        middle.push(same(a[start + i]));
        i++;
        j++;
      } else if (i < n && (j === m || lcs[at(i + 1, j)] >= lcs[at(i, j + 1)])) {
        // A line's old form before its new one, as a diff is read.
        middle.push({ kind: "removed", text: a[start + i++] });
      } else {
        middle.push({ kind: "added", text: b[start + j++] });
      }
    }
  }
  return [
    ...a.slice(0, start).map(same),
    ...middle,
    ...a.slice(endA).map(same),
  ];
}

/** A run of lines to show, or of unchanged lines folded away. */
export type DiffHunk = { kind: "lines" | "folded"; lines: DiffLine[] };

/** The changed lines with `context` unchanged ones around each change. */
export function diffHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const shown = lines.map(() => false);
  lines.forEach((line, i) => {
    if (line.kind === "same") return;
    for (
      let k = Math.max(0, i - context);
      k <= Math.min(lines.length - 1, i + context);
      k++
    )
      shown[k] = true;
  });
  const hunks: DiffHunk[] = [];
  lines.forEach((line, i) => {
    const kind = shown[i] ? "lines" : "folded";
    const last = hunks[hunks.length - 1];
    if (last?.kind === kind) last.lines.push(line);
    else hunks.push({ kind, lines: [line] });
  });
  return hunks;
}

type Entry = Record<string, unknown>;

function entryKey(entry: Entry, index: number): string {
  if (typeof entry.uuid === "string") return entry.uuid;
  if (typeof entry.block === "string") return `block:${entry.block}:${index}`;
  return `#${index}`;
}

function entryName(entry: Entry): string {
  for (const key of ["serviceName", "serviceId", "uuid"])
    if (typeof entry[key] === "string" && entry[key]) return entry[key] as string;
  if (typeof entry.block === "string") return `block ${entry.block}`;
  return "a service";
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortedJSON(a)) === JSON.stringify(sortedJSON(b));
}

/**
 * What a proposal does to the board, one sentence per change: runtimes and
 * services added, removed, changed or reordered, and the board's other parts
 * changed. Services are matched by uuid, so one that keeps its uuid and
 * changes its state is changed, not replaced.
 */
export function describeProposal(
  current: BoardDescriptor,
  proposed: BoardDescriptor,
): string[] {
  const said: string[] = [];
  if ((current.boardName ?? "") !== (proposed.boardName ?? ""))
    said.push(`Renames the board to “${proposed.boardName ?? ""}”`);
  const before = new Map(current.runtimes.map((rt) => [rt.id, rt]));
  const after = new Map(proposed.runtimes.map((rt) => [rt.id, rt]));
  for (const rt of current.runtimes)
    if (!after.has(rt.id)) said.push(`Removes runtime ${rt.name}`);
  for (const rt of proposed.runtimes) {
    const was = before.get(rt.id);
    if (!was) {
      said.push(`Adds runtime ${rt.name}`);
      continue;
    }
    if (was.name !== rt.name)
      said.push(`Renames runtime ${was.name} to ${rt.name}`);
    const { name: _a, ...wasRest } = was;
    const { name: _b, ...rest } = rt;
    if (!same(wasRest, rest)) said.push(`Changes runtime ${rt.name}`);
  }
  if (
    current.runtimes.filter((rt) => after.has(rt.id)).map((rt) => rt.id).join("\n") !==
    proposed.runtimes.filter((rt) => before.has(rt.id)).map((rt) => rt.id).join("\n")
  )
    said.push("Reorders the runtimes");

  for (const rt of proposed.runtimes) {
    const services = (proposed.services?.[rt.id] ?? []) as unknown as Entry[];
    if (!before.has(rt.id)) {
      if (services.length)
        said.push(
          `Puts ${services.map(entryName).join(", ")} in ${rt.name}`,
        );
      continue;
    }
    const was = (current.services?.[rt.id] ?? []) as unknown as Entry[];
    const wasByKey = new Map(was.map((e, i) => [entryKey(e, i), e]));
    const nowByKey = new Map(services.map((e, i) => [entryKey(e, i), e]));
    for (const [key, entry] of wasByKey)
      if (!nowByKey.has(key))
        said.push(`Removes ${entryName(entry)} from ${rt.name}`);
    for (const [key, entry] of nowByKey) {
      const prior = wasByKey.get(key);
      if (!prior) said.push(`Adds ${entryName(entry)} to ${rt.name}`);
      else if (!same(prior, entry))
        said.push(`Changes ${entryName(entry)} in ${rt.name}`);
    }
    const kept = (keys: string[], other: Map<string, Entry>) =>
      keys.filter((key) => other.has(key)).join("\n");
    if (
      kept([...wasByKey.keys()], nowByKey) !== kept([...nowByKey.keys()], wasByKey)
    )
      said.push(`Reorders the services in ${rt.name}`);
  }

  const parts: Array<[keyof BoardDescriptor, string]> = [
    ["facade", "the facade"],
    ["blocks", "the blocks"],
    ["assets", "the assets"],
    ["units", "the units"],
    ["description", "the description"],
  ];
  for (const [key, label] of parts) {
    const a = current[key];
    const b = proposed[key];
    if (a === undefined && b !== undefined) said.push(`Adds ${label}`);
    else if (a !== undefined && b === undefined) said.push(`Removes ${label}`);
    else if (!same(a, b)) said.push(`Changes ${label}`);
  }
  return said;
}
