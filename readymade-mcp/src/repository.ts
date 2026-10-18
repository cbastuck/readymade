import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { readCommit } from "./git.js";
import {
  canonicalServiceId,
  normalizeRuntime,
  type ConfigurationProperty,
  type KnowledgeKind,
  type KnowledgeReference,
  type Provenance,
  type RuntimeName,
  type ServiceAvailability,
  type ServiceContract,
} from "./types.js";
import { validateBoard, type ValidationCatalog } from "./validation.js";

interface Entry {
  kind: KnowledgeKind;
  title: string;
  relativePath: string;
  content: string;
  runtimes: RuntimeName[];
  serviceIds: string[];
  provenance: Provenance;
}

interface ParsedServiceDocument {
  name: string;
  summary: string;
  availability: ServiceAvailability[];
  inputTypes: string[];
  outputTypes: string[];
  configuration: ConfigurationProperty[];
}

const sourceRoots: Array<{ directory: string; repository: string; runtime: RuntimeName; extensions: string[] }> = [
  { directory: "hkp-frontend/src/runtime/browser", repository: "readymade", runtime: "browser", extensions: [".ts", ".tsx"] },
  { directory: "hkp-node/src", repository: "hkp-node", runtime: "node", extensions: [".ts"] },
  { directory: "hkp-python/src/hkp", repository: "hkp-python", runtime: "python", extensions: [".py"] },
  { directory: "hkp-rt/lib", repository: "readymade", runtime: "cpp", extensions: [".h", ".hpp", ".cpp"] },
];

const knownTypes = [
  "FloatRingBuffer",
  "ControlFlowData",
  "BinaryData",
  "MixedData",
  "TextData",
  "Undefined",
  "String",
  "JSON",
  "Null",
  "Any",
] as const;

function contentSha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function walk(directory: string, extensions: string[]): Promise<string[]> {
  const result: string[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute, extensions));
    else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) result.push(absolute);
  }
  return result;
}

function heading(content: string, fallback: string): string {
  return /^#\s+(.+)$/m.exec(content)?.[1].trim() ?? fallback;
}

function firstParagraph(content: string): string {
  const withoutTitle = content.replace(/^#\s+.+\n+/, "");
  return withoutTitle.split(/\n\s*\n/).map((part) => part.trim()).find((part) => part && !part.startsWith("---") && !part.startsWith("#")) ?? "";
}

function section(content: string, names: string[]): string {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = new RegExp(`^##\\s+(?:${escaped})\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, "im").exec(content);
  return match?.[1]?.trim() ?? "";
}

function extractTypes(value: string): string[] {
  const result = new Set<string>();
  for (const type of knownTypes) {
    if (new RegExp(`\\b${type}\\b`, "i").test(value)) result.add(type);
  }
  if (/any\s+(?:json\s+)?value/i.test(value)) result.add("Any");
  if (/object|array|structured/i.test(value)) result.add("JSON");
  return [...result];
}

function parseAvailability(content: string): ServiceAvailability[] {
  const found = new Map<string, ServiceAvailability>();
  // `| Runtime | `id` |`, or several ids in one cell when a page documents
  // services that belong together: `| Browser | `a`, `b` |`. The cell must hold
  // nothing but ids, which keeps configuration tables out.
  const tablePattern = /^\|\s*([^|]+?)\s*\|\s*(`[^`]+`(?:\s*,\s*`[^`]+`)*)\s*\|/gm;
  const bulletPattern = /^[-*]\s+(.+?)\s+[—-]+\s+service ID\s+(`[^`]+`)/gim;
  for (const pattern of [tablePattern, bulletPattern]) {
    for (const match of content.matchAll(pattern)) {
      const runtime = normalizeRuntime(match[1]);
      if (!runtime) continue;
      for (const id of match[2].matchAll(/`([^`]+)`/g)) {
        const serviceId = id[1].trim();
        found.set(`${runtime}:${serviceId}`, { runtime, serviceId });
      }
    }
  }
  return [...found.values()];
}

function parseConfiguration(content: string): ConfigurationProperty[] {
  const configuration = section(content, ["Configuration", "Configuration options", "Configuration Options"]);
  const result: ConfigurationProperty[] = [];
  for (const line of configuration.split("\n")) {
    const cells = splitMarkdownTableRow(line).map((cell) => cell.trim().replace(/^`|`$/g, ""));
    if (cells.length < 3 || /^-+$/.test(cells[0]) || /^property$/i.test(cells[0])) continue;
    result.push({
      property: cells[0].replace(/`/g, ""),
      type: cells[1].replace(/`/g, ""),
      defaultValue: cells.length >= 4 ? cells[2].replace(/`/g, "") : undefined,
      description: cells.at(-1)?.replace(/`/g, "") ?? "",
    });
  }
  return result;
}

function splitMarkdownTableRow(line: string): string[] {
  if (!line.trim().startsWith("|")) return [];
  const cells: string[] = [];
  let cell = "";
  let inCode = false;
  for (let index = 1; index < line.length; index += 1) {
    const character = line[index];
    if (character === "`" && line[index - 1] !== "\\") inCode = !inCode;
    if (character === "|" && line[index - 1] !== "\\" && !inCode) {
      cells.push(cell.replaceAll("\\|", "|"));
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.trim()) cells.push(cell);
  return cells;
}

function parseServiceDocument(content: string, fallbackName: string): ParsedServiceDocument {
  const availability = parseAvailability(content);
  const io = section(content, ["Input / Output", "Input and output", "Input and Output", "Output Data"]);
  const inputLines = io.split("\n").filter((line) => /input/i.test(line)).join(" ");
  const outputLines = io.split("\n").filter((line) => /output|emits|returns/i.test(line)).join(" ");
  return {
    name: heading(content, fallbackName),
    summary: firstParagraph(content),
    availability,
    inputTypes: extractTypes(inputLines),
    outputTypes: extractTypes(outputLines || io),
    configuration: parseConfiguration(content),
  };
}

function serviceIdsFromBoard(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) serviceIdsFromBoard(entry, output);
  } else if (typeof value === "object" && value !== null) {
    const object = value as Record<string, unknown>;
    if (typeof object.serviceId === "string") output.add(canonicalServiceId(object.serviceId));
    for (const nested of Object.values(object)) serviceIdsFromBoard(nested, output);
  }
  return output;
}

function runtimesFromBoard(value: unknown): RuntimeName[] {
  if (typeof value !== "object" || value === null || !Array.isArray((value as Record<string, unknown>).runtimes)) return [];
  const result = new Set<RuntimeName>();
  for (const runtime of (value as { runtimes: unknown[] }).runtimes) {
    if (typeof runtime !== "object" || runtime === null) continue;
    const item = runtime as Record<string, unknown>;
    const normalized = item.type === "browser" ? "browser" : normalizeRuntime(`${item.name ?? ""} ${item.id ?? ""} ${item.url ?? ""}`);
    if (normalized) result.add(normalized);
  }
  return [...result];
}

function excerpt(content: string, queryTokens: string[], maxLength = 700): string {
  const lower = content.toLowerCase();
  const indexes = queryTokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0);
  const center = indexes.length ? Math.min(...indexes) : 0;
  const start = Math.max(0, center - Math.floor(maxLength / 3));
  const prefix = start > 0 ? "…" : "";
  const suffix = start + maxLength < content.length ? "…" : "";
  return `${prefix}${content.slice(start, start + maxLength).trim()}${suffix}`;
}

function score(entry: Entry, tokens: string[]): number {
  const pathText = `${entry.relativePath} ${entry.title} ${entry.serviceIds.join(" ")}`.toLowerCase();
  const content = entry.content.toLowerCase();
  let value = 0;
  for (const token of tokens) {
    if (pathText.includes(token)) value += 12;
    const matches = content.split(token).length - 1;
    value += Math.min(matches, 8);
  }
  return value;
}

function provenanceFor(entry: Entry, requestedVersion?: string): Provenance {
  return { ...entry.provenance, exactBuildMatch: !requestedVersion || requestedVersion === entry.provenance.buildVersion };
}

export class KnowledgeRepository implements ValidationCatalog {
  private readonly byPath = new Map<string, Entry>();
  private readonly contracts: ServiceContract[] = [];

  private constructor(
    readonly root: string,
    readonly buildVersion: string,
    readonly commit: string,
    readonly indexedAt: string,
    private readonly entries: Entry[],
    private readonly sourceEntries: Entry[],
  ) {
    for (const entry of entries) this.byPath.set(entry.relativePath, entry);
    this.buildContracts();
  }

  static async create(root: string, buildVersion = process.env.READYMADE_BUILD_VERSION ?? "workspace"): Promise<KnowledgeRepository> {
    const absoluteRoot = path.resolve(root);
    const rootCommit = await readCommit(absoluteRoot);
    const indexedAt = new Date().toISOString();
    const entries: Entry[] = [];
    const sourceEntries: Entry[] = [];

    for (const absolute of await walk(path.join(absoluteRoot, "docs", "content"), [".md"])) {
      const relativePath = path.relative(absoluteRoot, absolute).split(path.sep).join("/");
      const content = await readFile(absolute, "utf8");
      const isService = relativePath.startsWith("docs/content/services/");
      const parsed = isService ? parseServiceDocument(content, path.basename(absolute, ".md")) : undefined;
      entries.push({
        kind: isService ? "service" : "documentation",
        title: heading(content, path.basename(absolute, ".md")),
        relativePath,
        content,
        runtimes: parsed ? [...new Set(parsed.availability.map((item) => item.runtime))] : [],
        serviceIds: parsed ? [...new Set(parsed.availability.map((item) => canonicalServiceId(item.serviceId)))] : [],
        provenance: { repository: "readymade", commit: rootCommit, contentSha256: contentSha256(content), path: relativePath, buildVersion, exactBuildMatch: true, indexedAt },
      });
    }

    for (const absolute of await walk(path.join(absoluteRoot, "boards"), [".json"])) {
      const relativePath = path.relative(absoluteRoot, absolute).split(path.sep).join("/");
      const content = await readFile(absolute, "utf8");
      let parsed: unknown;
      try { parsed = JSON.parse(content); } catch { parsed = undefined; }
      const boardName = typeof parsed === "object" && parsed !== null && typeof (parsed as Record<string, unknown>).boardName === "string"
        ? String((parsed as Record<string, unknown>).boardName)
        : path.basename(absolute, ".json");
      entries.push({
        kind: "board",
        title: boardName,
        relativePath,
        content,
        runtimes: runtimesFromBoard(parsed),
        serviceIds: [...serviceIdsFromBoard(parsed)],
        provenance: { repository: "readymade", commit: rootCommit, contentSha256: contentSha256(content), path: relativePath, buildVersion, exactBuildMatch: true, indexedAt },
      });
    }

    for (const sourceRoot of sourceRoots) {
      const worktree = path.join(absoluteRoot, sourceRoot.directory.split("/")[0]);
      const sourceCommit = sourceRoot.repository === "readymade" ? rootCommit : await readCommit(worktree);
      for (const absolute of await walk(path.join(absoluteRoot, sourceRoot.directory), sourceRoot.extensions)) {
        const relativePath = path.relative(absoluteRoot, absolute).split(path.sep).join("/");
        const content = await readFile(absolute, "utf8");
        sourceEntries.push({
          kind: "source",
          title: path.basename(absolute),
          relativePath,
          content,
          runtimes: [sourceRoot.runtime],
          serviceIds: [],
          provenance: { repository: sourceRoot.repository, commit: sourceCommit, contentSha256: contentSha256(content), path: relativePath, buildVersion, exactBuildMatch: true, indexedAt },
        });
      }
    }
    return new KnowledgeRepository(absoluteRoot, buildVersion, rootCommit, indexedAt, entries, sourceEntries);
  }

  private buildContracts(): void {
    for (const entry of this.entries.filter((item) => item.kind === "service")) {
      const parsed = parseServiceDocument(entry.content, entry.title);
      for (const availability of parsed.availability) {
        const canonical = canonicalServiceId(availability.serviceId);
        const sourceReferences = this.findSourceEntries(canonical, availability.runtime, 5).map((source) => source.provenance);
        this.contracts.push({
          serviceId: availability.serviceId,
          name: parsed.name,
          runtime: availability.runtime,
          aliases: parsed.availability
            .filter((item) => item.runtime === availability.runtime && item.serviceId !== availability.serviceId)
            .map((item) => item.serviceId),
          inputTypes: parsed.inputTypes,
          outputTypes: parsed.outputTypes,
          configuration: parsed.configuration,
          summary: parsed.summary,
          documentation: entry.provenance,
          sourceReferences,
        });
      }
    }
  }

  /** Every indexed service contract, one per runtime and service ID. */
  listContracts(): readonly ServiceContract[] {
    return this.contracts;
  }

  hasService(serviceId: string, runtime?: RuntimeName): boolean {
    const canonical = canonicalServiceId(serviceId);
    return this.contracts.some((contract) => canonicalServiceId(contract.serviceId) === canonical && (!runtime || contract.runtime === runtime));
  }

  search(query: string, options: { runtime?: RuntimeName; kind?: KnowledgeKind; limit?: number } = {}): KnowledgeReference[] {
    const tokens = query.toLowerCase().split(/[^a-z0-9_./-]+/).filter((token) => token.length > 1);
    if (!tokens.length) return [];
    const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
    return this.entries
      .filter((entry) => !options.kind || entry.kind === options.kind)
      .filter((entry) => !options.runtime || entry.runtimes.length === 0 || entry.runtimes.includes(options.runtime))
      .map((entry) => ({ entry, score: score(entry, tokens) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.relativePath.localeCompare(b.entry.relativePath))
      .slice(0, limit)
      .map(({ entry, score: rank }) => ({
        kind: entry.kind,
        title: entry.title,
        excerpt: excerpt(entry.content, tokens),
        score: rank,
        runtimes: entry.runtimes,
        serviceIds: entry.serviceIds,
        provenance: entry.provenance,
      }));
  }

  readDocuments(paths: string[]): Array<{ content: string; provenance: Provenance }> {
    return paths.map((requestedPath) => {
      const normalized = requestedPath.replaceAll("\\", "/").replace(/^\.\//, "");
      const entry = this.byPath.get(normalized);
      if (!entry || (entry.kind !== "documentation" && entry.kind !== "service" && entry.kind !== "board")) {
        throw new Error(`Path is not an indexed document or board: ${requestedPath}`);
      }
      return { content: entry.content.slice(0, 80_000), provenance: entry.provenance };
    });
  }

  getServiceContract(serviceId: string, runtime: RuntimeName, version?: string): ServiceContract {
    const canonical = canonicalServiceId(serviceId);
    const contract = this.contracts.find((item) => item.runtime === runtime && canonicalServiceId(item.serviceId) === canonical);
    if (!contract) throw new Error(`No indexed ${runtime} contract for service '${serviceId}'.`);
    const exact = !version || version === this.buildVersion;
    return {
      ...contract,
      documentation: { ...contract.documentation, exactBuildMatch: exact },
      sourceReferences: contract.sourceReferences.map((item) => ({ ...item, exactBuildMatch: exact })),
      warning: exact ? undefined : `Requested build '${version}' is not indexed; this result describes '${this.buildVersion}'.`,
    };
  }

  findCompatibleServices(inputType: string, outputType: string, runtime?: RuntimeName): ServiceContract[] {
    const wantedInput = inputType.toLowerCase();
    const wantedOutput = outputType.toLowerCase();
    return this.contracts.filter((contract) => {
      if (runtime && contract.runtime !== runtime) return false;
      const inputs = contract.inputTypes.map((item) => item.toLowerCase());
      const outputs = contract.outputTypes.map((item) => item.toLowerCase());
      const inputMatch = inputs.includes(wantedInput) || inputs.includes("any") || wantedInput === "any";
      const outputMatch = outputs.includes(wantedOutput) || wantedOutput === "any";
      return inputMatch && outputMatch;
    }).slice(0, 30);
  }

  findBoardExamples(serviceIds: string[], runtime?: RuntimeName, limit = 10): KnowledgeReference[] {
    const wanted = new Set(serviceIds.map(canonicalServiceId));
    return this.entries
      .filter((entry) => entry.kind === "board")
      .filter((entry) => !runtime || entry.runtimes.includes(runtime))
      .map((entry) => ({ entry, matches: entry.serviceIds.filter((id) => wanted.has(canonicalServiceId(id))).length }))
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches || a.entry.relativePath.localeCompare(b.entry.relativePath))
      .slice(0, Math.max(1, Math.min(limit, 20)))
      .map(({ entry, matches }) => ({
        kind: "board",
        title: entry.title,
        excerpt: excerpt(entry.content, [...wanted]),
        score: matches,
        runtimes: entry.runtimes,
        serviceIds: entry.serviceIds,
        provenance: entry.provenance,
      }));
  }

  inspectServiceSource(serviceId: string, runtime: RuntimeName, version?: string, maxLines = 180): Array<{ content: string; lineStart: number; lineEnd: number; provenance: Provenance }> {
    const canonical = canonicalServiceId(serviceId);
    const exact = !version || version === this.buildVersion;
    return this.findSourceEntries(canonical, runtime, 5).map((entry) => {
      const lines = entry.content.split("\n");
      const token = canonical.replaceAll("-", "_");
      const matchIndex = lines.findIndex((line) => line.toLowerCase().includes(canonical) || line.toLowerCase().includes(token));
      const count = Math.max(20, Math.min(maxLines, 400));
      const lineStart = Math.max(1, (matchIndex >= 0 ? matchIndex + 1 : 1) - 20);
      const lineEnd = Math.min(lines.length, lineStart + count - 1);
      return {
        content: lines.slice(lineStart - 1, lineEnd).join("\n"),
        lineStart,
        lineEnd,
        provenance: { ...provenanceFor(entry, version), exactBuildMatch: exact },
      };
    });
  }

  validateBoard(board: unknown) {
    return validateBoard(board, this);
  }

  stats() {
    return { documents: this.entries.filter((entry) => entry.kind !== "board").length, boards: this.entries.filter((entry) => entry.kind === "board").length, contracts: this.contracts.length, sourceFiles: this.sourceEntries.length, buildVersion: this.buildVersion, commit: this.commit, indexedAt: this.indexedAt };
  }

  private findSourceEntries(serviceId: string, runtime: RuntimeName, limit: number): Entry[] {
    const tokens = [...new Set([serviceId, serviceId.replaceAll("-", "_"), serviceId.replaceAll("-", "")])].filter(Boolean);
    return this.sourceEntries
      .filter((entry) => entry.runtimes.includes(runtime))
      .map((entry) => {
        const lowerPath = entry.relativePath.toLowerCase();
        const lowerContent = entry.content.toLowerCase();
        let rank = 0;
        for (const token of tokens) {
          if (lowerPath.includes(token)) rank += 30;
          if (lowerContent.includes(`serviceid: \"${token}\"`) || lowerContent.includes(`service_id=\"${token}\"`) || lowerContent.includes(`\"${token}\"`)) rank += 15;
          else if (lowerContent.includes(token)) rank += 2;
        }
        return { entry, rank };
      })
      .filter((item) => item.rank >= 15)
      .sort((a, b) => b.rank - a.rank || a.entry.relativePath.localeCompare(b.entry.relativePath))
      .slice(0, limit)
      .map((item) => item.entry);
  }
}

export async function findRepositoryRoot(start = process.cwd()): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    try {
      const docs = await stat(path.join(current, "docs", "content"));
      const boards = await stat(path.join(current, "boards"));
      if (docs.isDirectory() && boards.isDirectory()) return current;
    } catch { /* keep walking */ }
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Could not find a Readymade repository root containing docs/content and boards.");
    current = parent;
  }
}
