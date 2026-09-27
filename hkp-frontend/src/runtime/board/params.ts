/**
 * Parameters of a configuration document: `{{param.name}}` in a service's
 * state, given a value by whoever uses or applies the document.
 *
 * A reference that is a whole string takes the parameter's value, of whatever
 * type it is — a number stays a number, a block name stays usable as one. A
 * reference inside a longer string is written into it as text. A reference with
 * no value is left as it stands and named, the way a unit's parameters are:
 * emptying it would produce a service that does something wrong quietly.
 *
 * Distinct from a unit's parameters (`runtime/board/units`), which are strings
 * substituted over a whole board document. The syntax is shared and the scope
 * is lexical: inside a block or preset it names that document's parameter.
 */

const WHOLE_PARAM = /^\{\{\s*param\.([A-Za-z0-9_.-]+)\s*\}\}$/;
const PARAM = /\{\{\s*param\.([A-Za-z0-9_.-]+)\s*\}\}/g;

/** Substitutes parameters anywhere in a structure. */
export function substituteParams<T>(
  value: T,
  params: Record<string, unknown>,
  missing?: Set<string>,
): T {
  const walk = (current: unknown): unknown => {
    if (typeof current === "string") {
      const whole = current.match(WHOLE_PARAM);
      if (whole) {
        if (Object.prototype.hasOwnProperty.call(params, whole[1])) {
          return params[whole[1]];
        }
        missing?.add(whole[1]);
        return current;
      }
      return current.replace(PARAM, (reference, name: string) => {
        if (Object.prototype.hasOwnProperty.call(params, name)) {
          return String(params[name]);
        }
        missing?.add(name);
        return reference;
      });
    }
    if (Array.isArray(current)) {
      return current.map(walk);
    }
    if (current && typeof current === "object") {
      return Object.fromEntries(
        Object.entries(current).map(([key, inner]) => [key, walk(inner)]),
      );
    }
    return current;
  };
  return walk(value) as T;
}

/** Every parameter a structure refers to, however deeply nested. */
export function referencedParams(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (current: unknown): void => {
    if (typeof current === "string") {
      for (const match of current.matchAll(PARAM)) {
        found.add(match[1]);
      }
    } else if (Array.isArray(current)) {
      current.forEach(walk);
    } else if (current && typeof current === "object") {
      Object.values(current).forEach(walk);
    }
  };
  walk(value);
  return [...found];
}
