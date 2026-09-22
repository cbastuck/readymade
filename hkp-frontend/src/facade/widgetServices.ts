import { LayoutItem } from "./types";

/**
 * Which services a widget names, wherever in its configuration it names them.
 *
 * Found by the shape of the property rather than from a list of the widgets
 * that have one: a `source`, an `action`, an entry in `actions`, the bare
 * `serviceUuid` of a widget that embeds a service's own surface, and the second
 * reference a widget sometimes keeps beside its main one
 * (`progressServiceUuid`, `thresholdKnobServiceUuid`) are all spelled the same
 * way, so a widget added later is covered without this being edited.
 *
 * Two things are deliberately not walked. A container's children answer for
 * themselves, because each is rendered by a node of its own, and a repeat's
 * template names nothing until an item has been substituted into it. And a
 * payload — what a `configure` or a `process` carries — is the target service's
 * business: a uuid inside one is a value being sent somewhere, not an address
 * this facade dials, and may well name something on another board.
 */

const NOT_WALKED = new Set(["items", "template", "configure", "payload"]);

function isReference(name: string): boolean {
  return name === "serviceUuid" || name.endsWith("ServiceUuid");
}

function collect(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collect(entry, found);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [name, entry] of Object.entries(value)) {
    if (NOT_WALKED.has(name)) {
      continue;
    }
    if (typeof entry === "string") {
      if (isReference(name)) {
        found.add(entry);
      }
      continue;
    }
    collect(entry, found);
  }
}

export function widgetServiceUuids(item: LayoutItem): string[] {
  const found = new Set<string>();
  collect(item, found);
  return [...found];
}
