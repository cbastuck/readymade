/**
 * Filling a template out of one item.
 *
 * Shared by every widget that draws the same shape once per thing it was given —
 * a `repeat` over its items, a `calendar` over its cells. What the widget draws
 * is written once in the board; this is what makes each copy about a particular
 * item.
 */
import { resolvePath } from "./readValue";

/** "{{item}}" or "{{item.some.path}}" — nothing else is a reference. */
const ITEM_REF = /\{\{item(?:\.([A-Za-z0-9_$.]+))?\}\}/g;

/** What an item reference points at: the item itself, or a field of it. */
function itemValue(item: unknown, path: string | undefined): unknown {
  return path ? resolvePath(item, path) : item;
}

/**
 * Recursively replaces item references in a template with the current item.
 *
 * A string that is *exactly* one reference becomes that value whole, so a
 * number stays a number and an object stays an object — which is what lets a
 * repeated widget take its payload values, and not only its labels, from the
 * item. A reference inside a longer string is text, and is printed into it.
 */
export function interpolateTemplate(template: unknown, item: unknown): unknown {
  if (typeof template === "string") {
    const whole = template.match(/^\{\{item(?:\.([A-Za-z0-9_$.]+))?\}\}$/);
    if (whole) {
      return itemValue(item, whole[1]);
    }
    return template.replace(ITEM_REF, (_match, path?: string) => {
      const value = itemValue(item, path);
      if (value == null) {
        return "";
      }
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    });
  }
  if (Array.isArray(template)) {
    return template.map((v) => interpolateTemplate(v, item));
  }
  if (template !== null && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      result[k] = interpolateTemplate(v, item);
    }
    return result;
  }
  return template;
}
