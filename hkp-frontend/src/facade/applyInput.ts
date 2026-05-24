// Recursively walks a configure template and replaces the sentinel "$$input"
// with the provided value. An exact string match returns the value as-is
// (preserving non-string types like arrays or objects). A partial match
// ($$input appears inside a longer string) only substitutes when value is a
// string.
export function applyInput(template: unknown, input: unknown): unknown {
  if (template === "$$input") {
    return input;
  }
  if (typeof template === "string") {
    return typeof input === "string" ? template.replace("$$input", input) : template;
  }
  if (Array.isArray(template)) {
    return template.map((item) => applyInput(item, input));
  }
  if (template !== null && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      result[k] = applyInput(v, input);
    }
    return result;
  }
  return template;
}
