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

/**
 * `{{random}}` in a parameter's value: a value nobody chose, made once for
 * whoever takes it. For what must differ between two uses of the same
 * document and must not be guessable — an ntfy topic, a channel name — where
 * a fixed default would put every copy of a board on the same one.
 */
const RANDOM = /\{\{\s*random\s*\}\}/g;

/** 20 lowercase letters and digits: about 103 bits, and valid in a URL path, a topic, a file name. */
export function randomToken(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * The parameters whose value asks for something random, each with one made.
 * Only those: the caller decides where the made values are kept, since a value
 * made again on every read would be a different one each time.
 */
export function generatedParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const made: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "string" && value.match(RANDOM)) {
      made[name] = value.replace(RANDOM, () => randomToken());
    }
  }
  return made;
}
