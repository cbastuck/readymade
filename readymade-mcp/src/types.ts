export const runtimeNames = ["browser", "node", "python", "cpp", "go", "graphql"] as const;
export type RuntimeName = (typeof runtimeNames)[number];

export type KnowledgeKind = "documentation" | "board" | "service" | "source";

export interface Provenance {
  repository: string;
  commit: string;
  /** Hash of the exact indexed bytes, including uncommitted workspace content. */
  contentSha256?: string;
  path: string;
  buildVersion: string;
  exactBuildMatch: boolean;
  indexedAt: string;
}

export interface KnowledgeReference {
  kind: KnowledgeKind;
  title: string;
  excerpt: string;
  score: number;
  runtimes: RuntimeName[];
  serviceIds: string[];
  provenance: Provenance;
}

export interface ServiceAvailability {
  runtime: RuntimeName;
  serviceId: string;
}

export interface ConfigurationProperty {
  property: string;
  type: string;
  defaultValue?: string;
  description: string;
}

export interface ServiceContract {
  serviceId: string;
  name: string;
  runtime: RuntimeName;
  aliases: string[];
  inputTypes: string[];
  outputTypes: string[];
  configuration: ConfigurationProperty[];
  summary: string;
  documentation: Provenance;
  sourceReferences: Provenance[];
  warning?: string;
}

export interface BoardDiagnostic {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
  serviceId?: string;
  runtime?: RuntimeName;
}

export interface BoardValidationResult {
  valid: boolean;
  mode: "static";
  diagnostics: BoardDiagnostic[];
  checkedServices: number;
  provenance: Omit<Provenance, "path">;
}

export function canonicalServiceId(serviceId: string): string {
  return serviceId.trim().toLowerCase().replace(/^hookup\.to\/service\//, "");
}

export function normalizeRuntime(value: string): RuntimeName | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("browser")) return "browser";
  if (normalized.includes("node")) return "node";
  if (normalized.includes("python")) return "python";
  if (normalized === "c++" || normalized.includes("hkp-rt") || normalized.includes("cpp")) return "cpp";
  if (normalized.includes("go")) return "go";
  if (normalized.includes("graphql")) return "graphql";
  return undefined;
}
