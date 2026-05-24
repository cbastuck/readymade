export type Path = Array<string | number>;
export type JsonType = "string" | "number" | "boolean" | "null" | "array" | "object";

export const JSON_TYPES: JsonType[] = ["string", "number", "boolean", "null", "array", "object"];

export function getAtPath(obj: any, path: Path): any {
  return path.reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

export function setAtPath(obj: any, path: Path, value: any): any {
  if (path.length === 0) { return value; }
  const [head, ...tail] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[head as number] = setAtPath(copy[head as number], tail, value);
    return copy;
  }
  return { ...obj, [head as string]: setAtPath(obj[head as string], tail, value) };
}

export function deleteAtPath(obj: any, path: Path, key: string | number): any {
  const current = getAtPath(obj, path);
  if (Array.isArray(current)) {
    const copy = [...current];
    copy.splice(key as number, 1);
    return setAtPath(obj, path, copy);
  }
  const copy = { ...current };
  delete copy[key as string];
  return setAtPath(obj, path, copy);
}

export function addAtPath(obj: any, path: Path, key: string | number, value: any): any {
  const current = getAtPath(obj, path);
  if (Array.isArray(current)) {
    return setAtPath(obj, path, [...current, value]);
  }
  return setAtPath(obj, path, { ...current, [key as string]: value });
}

export function defaultForType(type: JsonType): any {
  if (type === "string") { return ""; }
  if (type === "number") { return 0; }
  if (type === "boolean") { return false; }
  if (type === "null") { return null; }
  if (type === "array") { return []; }
  return {};
}
