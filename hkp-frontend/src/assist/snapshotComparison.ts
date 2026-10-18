import { toCanonicalServiceId } from "../types";

/** Timer reports its live counter alongside configuration for save/restore.
 * Ticks are not edits. Ignore that field only in Timer state, including nested
 * pipelines and imported units; retain it in the actual board and undo snapshot.
 * Sorting object keys also avoids treating equivalent JSON as a changed board.
 * Arrays retain their order because runtime and service ordering is the wiring.
 */
function comparable(value: unknown, timerState = false): unknown {
  if (Array.isArray(value)) return value.map(item => comparable(item));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const isTimer = typeof record.serviceId === "string" &&
    toCanonicalServiceId(record.serviceId) === "timer";
  return Object.fromEntries(Object.keys(record).sort()
    .filter(key => !(timerState && key === "counter"))
    .map(key => [key, comparable(record[key], isTimer && key === "state")]));
}

export function matchesAssistSnapshot(snapshot: unknown, base: string | undefined): boolean {
  if (!base) return false;
  try {
    return JSON.stringify(comparable(snapshot)) === JSON.stringify(comparable(JSON.parse(base)));
  } catch {
    return false;
  }
}
