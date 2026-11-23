import type { KnowledgeDocument } from "./knowledge";

/**
 * A TypeScript file read one declaration at a time. The facade's schema is its
 * commented types (`hkp-frontend/src/facade/types.ts`), far more together than
 * a small model's context holds beside a board; a widget's shape is a few
 * hundred characters of it. `path#Name` names one top-level exported type or
 * interface, read with the comment above it and followed by the other
 * declarations of the file it names, as paths to read next.
 *
 * Read from the whole file wherever it came from — the bundled documentation
 * or a knowledge server — so a server needs to know nothing of parts.
 */

const DECLARATION = /^export (?:type|interface) ([A-Za-z_$][\w$]*)/;
const COMMENT = /^\s*(\/\/|\/\*|\*)/;

export type Declaration = { name: string; text: string };

/** The file's top-level exported declarations, in order, each with its comment. */
export function declarationsOf(source: string): Declaration[] {
  const lines = source.split("\n");
  const starts: Array<{ name: string; line: number }> = [];
  lines.forEach((line, index) => {
    const match = DECLARATION.exec(line);
    if (!match) return;
    let start = index;
    while (start > 0 && COMMENT.test(lines[start - 1])) start--;
    starts.push({ name: match[1], line: start });
  });
  return starts.map(({ name, line }, i) => ({
    name,
    text: lines
      .slice(line, starts[i + 1]?.line ?? lines.length)
      .join("\n")
      .trimEnd(),
  }));
}

/** A documentation path and the declaration it names, if it names one. */
export function splitDocumentPath(path: string): { file: string; name?: string } {
  const hash = path.indexOf("#");
  if (hash < 0) return { file: path };
  const file = path.slice(0, hash);
  // Only a TypeScript file has declarations; anything else is read as named.
  if (!/\.tsx?$/.test(file)) return { file: path };
  return { file, name: path.slice(hash + 1) };
}

/** One declaration of `source`, and what else of the file it names. */
export function readDeclaration(file: string, name: string, source: string): string {
  const all = declarationsOf(source);
  const found = all.find((declaration) => declaration.name === name);
  if (!found)
    throw new Error(
      `${file} has no declaration ${name}. It has: ${all.map((d) => d.name).join(", ")}.`,
    );
  const named = all
    .filter((d) => d !== found && new RegExp(`\\b${d.name}\\b`).test(found.text))
    .map((d) => `${file}#${d.name}`);
  return named.length
    ? `${found.text}\n\n// Named above, each readable on its own: ${named.join(", ")}`
    : found.text;
}

/**
 * The declaration whose `type` is `tag` — `"knob"` is `KnobWidget` — where
 * one says so as its first `type` property.
 */
export function declarationTagged(source: string, tag: string): string | undefined {
  return declarationsOf(source).find(
    ({ text }) => /^\s*type: "([^"]+)";/m.exec(text)?.[1] === tag,
  )?.name;
}

/**
 * `paths` read through `read`, a declaration path answered with that
 * declaration alone. Each file is read once, however many parts of it are
 * asked for.
 */
export async function readDocumentParts(
  paths: string[],
  read: (paths: string[]) => Promise<KnowledgeDocument[]>,
): Promise<KnowledgeDocument[]> {
  const parts = paths.map(splitDocumentPath);
  if (!parts.some((part) => part.name)) return read(paths);
  const files = [...new Set(parts.map((part) => part.file))];
  const documents = await read(files);
  const byPath = new Map(documents.map((document) => [document.path, document]));
  return parts.map(({ file, name }, i) => {
    const document = byPath.get(file) ?? documents[files.indexOf(file)];
    if (!name) return document;
    return { path: paths[i], content: readDeclaration(file, name, document.content) };
  });
}
