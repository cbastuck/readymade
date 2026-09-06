/**
 * Reading a value out of what a service said.
 *
 * A widget's `source` names a service and, optionally, a path into the object
 * it notified with — so every widget that displays something does the same two
 * steps: walk the path, then coerce what is there into what the widget can
 * draw. Neither step needs to know a service exists.
 */

export function resolvePath(obj: any, path: string): any {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

/** The value at `path`, as something printable — objects fall back to JSON. */
export function extractText(notification: any, path?: string): string | null {
  if (notification == null) {
    return null;
  }
  const val = path ? resolvePath(notification, path) : notification;
  if (val == null) {
    return null;
  }
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  return JSON.stringify(val);
}
