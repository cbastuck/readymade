/**
 * A facade state value as the editor and the overlays show it: short, and
 * saying when there is none.
 */
export function describeValue(value: unknown): string {
  if (value === undefined) {
    return "not set";
  }
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > 160 ? `${text.slice(0, 159)}…` : text;
}
