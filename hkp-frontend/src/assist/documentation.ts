import boardFormat from "../../../docs/content/board-json.md?raw";
import introduction from "../../../docs/content/introduction.md?raw";

// Vite packages the repository documentation for every host, including offline
// native builds. Individual documents are loaded only when requested.
const documents = import.meta.glob<string>(
  [
    "../../../docs/content/**/*.md",
    "!../../../docs/content/board-json.md",
    "!../../../docs/content/introduction.md",
  ],
  { query: "?raw", import: "default" },
);
const examples = import.meta.glob<string>("../../../boards/*.json", {
  query: "?raw",
  import: "default",
});
const sources = Object.fromEntries([
  ["docs/board-json.md", async () => boardFormat],
  ["docs/introduction.md", async () => introduction],
  ...Object.entries(documents).map(([path, load]) => [
    path.replace("../../../docs/content/", "docs/"),
    load,
  ]),
  ...Object.entries(examples).map(([path, load]) => [
    path.replace("../../../boards/", "boards/"),
    load,
  ]),
]) as Record<string, () => Promise<string>>;

export const documentationIndex = Object.keys(sources).sort().join("\n");
export const foundation = `${introduction}\n\n${boardFormat}`;
export async function readDocumentation(paths: string[]) {
  if (
    !Array.isArray(paths) ||
    paths.length > 8 ||
    paths.some((path) => typeof path !== "string")
  ) {
    throw new Error(
      "Read between one and eight documentation paths at a time.",
    );
  }
  return Promise.all(
    paths.map(async (path) => {
      if (!Object.prototype.hasOwnProperty.call(sources, path))
        throw new Error(`Unknown documentation path: ${path}`);
      return { path, content: await sources[path]() };
    }),
  );
}
export async function searchDocumentation(query: string) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  if (!terms.length) return [];
  const matches = await Promise.all(
    Object.entries(sources).map(async ([path, load]) => {
      const content = await load();
      const lower = content.toLowerCase();
      const score = terms.reduce(
        (sum, term) =>
          sum +
          (path.toLowerCase().includes(term) ? 10 : 0) +
          (lower.includes(term) ? 1 : 0),
        0,
      );
      const position = Math.max(
        0,
        lower.indexOf(terms.find((term) => lower.includes(term)) ?? ""),
      );
      return {
        path,
        score,
        excerpt: content.slice(Math.max(0, position - 150), position + 700),
      };
    }),
  );
  return matches
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
