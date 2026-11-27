/**
 * Board resources, in one place.
 *
 * A resource is something a board needs from outside Readymade — a Postgres
 * database, an Ollama server, an S3 bucket — declared once in the board by
 * *kind* and named from service state by reference. The board holds
 * *descriptors*: an id, a kind, and what the board asks of it (`models`,
 * `version`, `extensions`, `buckets`).
 *
 *   A reference — `hkp-resource://<id>` — is what service state holds, as a
 *   whole field. `getState` echoes it and a saved board keeps it: the address
 *   and credentials never enter state, so there is nothing to take back out on
 *   save.
 *
 *   Providing is the host's, not the board's. A binding turns a resource
 *   descriptor into what a service is handed when the reference resolves
 *   (`{ url }` for `ollama`, `{ url, user, password, database }` for
 *   `postgres`, `{ endpoint, region, bucket, accessKey, secretKey }` for
 *   `s3`). The board says the same thing whether it gets its resource from a
 *   container, a native install, or an address the person gave.
 *
 *   Resolution happens in the runtime that uses the resource, at the moment it
 *   uses it, from that runtime's resource store. The store is pushed the
 *   bindings of the runtime's document — with the create payload, on attach,
 *   and whenever a binding changes — resolved for where that runtime runs.
 *
 * References are *found* by their scheme anywhere in a string — for saying
 * where a resource is used, and for renaming one. They are *resolved* only as
 * a whole value: nothing is spliced into longer text.
 *
 * The format matches hkp-node's `src/resources.ts`, hkp-python's
 * `hkp/resources.py` and hkp-rt's `resources.h`: a board written against one
 * runtime has to open against another.
 */

import { mapStrings } from "./traversal";

export const RESOURCE_SCHEME = "hkp-resource://";

export const RESOURCE_KINDS = ["ollama", "postgres", "s3"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

const ID = "[A-Za-z0-9_.-]+";
const ID_PATTERN = new RegExp(`^${ID}$`);
const WHOLE_REFERENCE = /^hkp-resource:\/\/([A-Za-z0-9_.-]+)$/;
const ANY_REFERENCE = /hkp-resource:\/\/([A-Za-z0-9_.-]+)/g;

export type OllamaResourceDescriptor = {
  id: string;
  name?: string;
  kind: "ollama";
  /** Models the board asks to have pulled. */
  models?: string[];
  runtimes?: string[];
};

export type PostgresResourceDescriptor = {
  id: string;
  name?: string;
  kind: "postgres";
  /** Major version the board asks for, e.g. `"16"`. */
  version?: string;
  /** Extensions the board asks to have available. */
  extensions?: string[];
  runtimes?: string[];
};

export type S3ResourceDescriptor = {
  id: string;
  name?: string;
  kind: "s3";
  /** Buckets the board asks to have present. */
  buckets?: string[];
  runtimes?: string[];
};

export type ResourceDescriptor =
  | OllamaResourceDescriptor
  | PostgresResourceDescriptor
  | S3ResourceDescriptor;

/** What a service is handed when an `ollama` resource resolves. */
export type ResolvedOllamaResource = {
  id: string;
  kind: "ollama";
  url: string;
};

/** What a service is handed when a `postgres` resource resolves. */
export type ResolvedPostgresResource = {
  id: string;
  kind: "postgres";
  url: string;
  user?: string;
  password?: string;
  database?: string;
};

/** What a service is handed when an `s3` resource resolves. */
export type ResolvedS3Resource = {
  id: string;
  kind: "s3";
  endpoint: string;
  region?: string;
  bucket?: string;
  accessKey?: string;
  secretKey?: string;
};

export type ResolvedResource =
  | ResolvedOllamaResource
  | ResolvedPostgresResource
  | ResolvedS3Resource;

/**
 * A binding as it travels to a runtime's resource store. Carries the resolved
 * fields for the kind, or `unreachable` when the resource is bound to an
 * address that runtime cannot reach (e.g. `127.0.0.1` on the person's laptop
 * for a runtime on another machine).
 */
export type ResourceBinding = ResolvedResource & {
  unreachable?: string;
};

/** What the runtimes are sent: bindings by id, `null` for one unbound or deleted. */
export type ResourcePush = Record<string, ResourceBinding | null>;

/**
 * The bindings a runtime's services may resolve: those of the document that
 * contributed the runtime, resolved for where that runtime runs. Read on each
 * call, so a binding changed while the board runs is what the next push or
 * resolution sees.
 */
export type ResourcesSource = () => ResourceBinding[];

export type ResourceResolution<T extends ResolvedResource = ResolvedResource> =
  | { resource: T; problem: "" }
  | { resource: null; problem: string };

/** A runtime as a resource's `runtimes` may name it. */
type ResourceRuntime = { id?: string; unit?: string; unitRuntimeId?: string };

/**
 * Whether a runtime is given a resource: every runtime is, unless the resource
 * names the ones that are. A runtime a unit contributed is named by the id it
 * has in that unit, which is the document the resource was written in.
 */
export function resourceReaches(
  resource: { runtimes?: string[] },
  runtime: ResourceRuntime,
): boolean {
  return (
    !resource.runtimes ||
    resource.runtimes.includes(runtime.unitRuntimeId ?? runtime.id ?? "")
  );
}

/**
 * The descriptors a runtime's services may reference: those of its document —
 * the board's own, or those of the unit that contributed the runtime — less
 * the ones kept to other runtimes.
 *
 * Without a runtime, the board's own, whole.
 */
export function resourcesOfRuntime(
  runtime: ResourceRuntime | undefined,
  resources: ResourceDescriptor[] | undefined,
  units: Array<{ name: string; source: { resources?: ResourceDescriptor[] } }> | undefined,
): ResourceDescriptor[] {
  if (!runtime) {
    return resources ?? [];
  }
  const declared = runtime.unit
    ? (units?.find((unit) => unit.name === runtime.unit)?.source.resources ?? [])
    : (resources ?? []);
  return declared.filter((resource) => resourceReaches(resource, runtime));
}

/** Bindings by id, as a runtime is sent them. */
export function resourcesById(
  resources: ResourceBinding[] | undefined,
): Record<string, ResourceBinding> {
  return Object.fromEntries((resources ?? []).map((resource) => [resource.id, resource]));
}

export function isResourceId(value: string): boolean {
  return ID_PATTERN.test(value);
}

export function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === "string" && (RESOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * The id a whole-value reference names, or null for anything else — a blank, a
 * literal, a reference inside longer text.
 */
export function parseResourceRef(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(WHOLE_REFERENCE);
  return match ? match[1] : null;
}

export function formatResourceRef(id: string): string {
  return `${RESOURCE_SCHEME}${id}`;
}

/**
 * Every resource id a value mentions, in the order they were found and without
 * duplicates. Walks the whole value — services nest, and a reference is legal
 * in whatever field a service resolves — and matches inside strings, so an
 * expression that picks between resources is still seen to reference them.
 */
export function findResourceRefs(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    for (const match of value.matchAll(ANY_REFERENCE)) {
      if (!into.includes(match[1])) {
        into.push(match[1]);
      }
    }
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      findResourceRefs(item, into);
    }
    return into;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      findResourceRefs(item, into);
    }
  }
  return into;
}

/**
 * The descriptors a set of services references, by id — for a board cut down
 * to some of its services, which takes the resources those name with it. A
 * reference to a resource the board does not declare is left out.
 */
export function referencedResources(
  services: Array<{ state?: unknown }> | undefined,
  resources: ResourceDescriptor[] | undefined,
): Record<string, ResourceDescriptor> {
  const wanted = findResourceRefs((services ?? []).map((svc) => svc.state));
  const found: Record<string, ResourceDescriptor> = {};
  for (const id of wanted) {
    const descriptor = resources?.find((resource) => resource.id === id);
    if (descriptor) {
      found[id] = descriptor;
    }
  }
  return found;
}

/** One place a service's state names a resource. */
export type ResourceUse = {
  runtimeId: string;
  serviceUuid: string;
  serviceName?: string;
  /** Keys from the service's state down to the string holding the reference. */
  path: Array<string | number>;
  resourceId: string;
};

/**
 * Every place the board's services name a resource. Found by a scan for the
 * scheme, so it is always what the board holds now.
 */
export function findResourceUses(
  services: {
    [runtimeId: string]: Array<{ uuid: string; serviceName?: string; state?: unknown }>;
  },
  resourceId?: string,
): ResourceUse[] {
  const uses: ResourceUse[] = [];
  for (const [runtimeId, list] of Object.entries(services ?? {})) {
    for (const svc of list ?? []) {
      const walk = (value: unknown, path: Array<string | number>) => {
        if (typeof value === "string") {
          for (const id of findResourceRefs(value)) {
            if (!resourceId || id === resourceId) {
              uses.push({
                runtimeId,
                serviceUuid: svc.uuid,
                serviceName: svc.serviceName,
                path,
                resourceId: id,
              });
            }
          }
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item, index) => walk(item, [...path, index]));
          return;
        }
        if (value && typeof value === "object") {
          for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            walk(item, [...path, key]);
          }
        }
      };
      walk(svc.state, []);
    }
  }
  return uses;
}

/**
 * A value with every reference to `from` naming `to` instead — whole values and
 * mentions inside text alike, which is what renaming a resource has to reach.
 * Returns the same object when nothing referenced it, so a caller can tell
 * which services need reconfiguring.
 */
export function renameResourceRefs<T>(value: T, from: string, to: string): T {
  const pattern = new RegExp(
    `hkp-resource://${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_.-])`,
    "g",
  );
  if (!findResourceRefs(value).includes(from)) {
    return value;
  }
  return mapStrings(value, (text) => text.replace(pattern, formatResourceRef(to)));
}

/**
 * Fields that belong to a binding rather than a descriptor — an address, a
 * port, a credential, or a container image. A board names a kind of resource,
 * never where it is or how to pull it.
 */
const FORBIDDEN_DESCRIPTOR_FIELDS = [
  "url",
  "endpoint",
  "host",
  "port",
  "user",
  "username",
  "password",
  "accessKey",
  "secretKey",
  "image",
] as const;

function cleanStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const kept = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return kept.length ? kept : [];
}

/**
 * One descriptor as a board declares it, or the reason it is not one.
 *
 * What makes it a resource — `id` and a known `kind` — is required. The fields
 * the kind allows a board to ask for (`models`, `version`, `extensions`,
 * `buckets`) are kept where they are well-formed and left out where they are
 * not. Address, credential and image fields are never kept.
 */
export function checkResourceDescriptor(value: unknown): ResourceDescriptor | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "a resource is an object";
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !isResourceId(record.id)) {
    return `${JSON.stringify(record.id)} is not a resource id: use letters, digits, ".", "-" and "_"`;
  }
  if (!isResourceKind(record.kind)) {
    return `resource "${record.id}" has unknown kind ${JSON.stringify(record.kind)} (expected one of: ${RESOURCE_KINDS.join(", ")})`;
  }

  const base: { id: string; name?: string; runtimes?: string[] } = { id: record.id };
  if (typeof record.name === "string" && record.name.trim()) {
    base.name = record.name;
  }
  if (Array.isArray(record.runtimes)) {
    base.runtimes = record.runtimes.filter((id): id is string => typeof id === "string");
  }

  switch (record.kind) {
    case "ollama": {
      const models = cleanStringList(record.models);
      return {
        ...base,
        kind: "ollama",
        ...(models !== undefined ? { models } : {}),
      };
    }
    case "postgres": {
      const version =
        typeof record.version === "string" && record.version.trim()
          ? record.version.trim()
          : typeof record.version === "number" && Number.isFinite(record.version)
            ? String(record.version)
            : undefined;
      const extensions = cleanStringList(record.extensions);
      return {
        ...base,
        kind: "postgres",
        ...(version !== undefined ? { version } : {}),
        ...(extensions !== undefined ? { extensions } : {}),
      };
    }
    case "s3": {
      const buckets = cleanStringList(record.buckets);
      return {
        ...base,
        kind: "s3",
        ...(buckets !== undefined ? { buckets } : {}),
      };
    }
  }
}

/**
 * A board's `resources`, read for loading: what can be used, and a sentence for
 * each entry that cannot, or that declares fields a board may not hold (an
 * address, a credential, or an image). An entry that is dropped costs that one
 * resource — the services naming it say so when they resolve — rather than the
 * board.
 */
export function readBoardResources(value: unknown): {
  resources: ResourceDescriptor[];
  problems: string[];
} {
  if (value === undefined) {
    return { resources: [], problems: [] };
  }
  if (!Array.isArray(value)) {
    return { resources: [], problems: ['"resources" is not a list'] };
  }
  const resources: ResourceDescriptor[] = [];
  const problems: string[] = [];
  for (const entry of value) {
    const checked = checkResourceDescriptor(entry);
    if (typeof checked === "string") {
      problems.push(checked);
      continue;
    }
    if (resources.some((resource) => resource.id === checked.id)) {
      problems.push(`resource "${checked.id}" is declared twice; the first is kept`);
      continue;
    }
    const record = entry as Record<string, unknown>;
    const forbidden = FORBIDDEN_DESCRIPTOR_FIELDS.filter(
      (field) => record[field] !== undefined,
    );
    if (forbidden.length) {
      problems.push(
        `resource "${checked.id}" declares ${forbidden.join(", ")}, which a board never holds; ignored`,
      );
    }
    resources.push(checked);
  }
  return { resources, problems };
}

/**
 * Reads one binding off the wire, or null when it is not one.
 */
export function readResourceBinding(
  value: unknown,
  fallbackId?: string,
): ResourceBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : fallbackId;
  if (!id || !isResourceId(id) || !isResourceKind(record.kind)) {
    return null;
  }
  const unreachable =
    typeof record.unreachable === "string" && record.unreachable.trim()
      ? record.unreachable.trim()
      : undefined;

  switch (record.kind) {
    case "ollama": {
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url && !unreachable) {
        return null;
      }
      return {
        id,
        kind: "ollama",
        url,
        ...(unreachable ? { unreachable } : {}),
      };
    }
    case "postgres": {
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url && !unreachable) {
        return null;
      }
      return {
        id,
        kind: "postgres",
        url,
        ...(typeof record.user === "string" ? { user: record.user } : {}),
        ...(typeof record.password === "string" ? { password: record.password } : {}),
        ...(typeof record.database === "string" ? { database: record.database } : {}),
        ...(unreachable ? { unreachable } : {}),
      };
    }
    case "s3": {
      const endpoint = typeof record.endpoint === "string" ? record.endpoint.trim() : "";
      if (!endpoint && !unreachable) {
        return null;
      }
      return {
        id,
        kind: "s3",
        endpoint,
        ...(typeof record.region === "string" ? { region: record.region } : {}),
        ...(typeof record.bucket === "string" ? { bucket: record.bucket } : {}),
        ...(typeof record.accessKey === "string" ? { accessKey: record.accessKey } : {}),
        ...(typeof record.secretKey === "string" ? { secretKey: record.secretKey } : {}),
        ...(unreachable ? { unreachable } : {}),
      };
    }
  }
}

/**
 * Reads a resources payload off the wire: a map of id to binding, where `null`
 * removes one, or a list of bindings. Anything it cannot read is dropped rather
 * than failing the request.
 */
export function readResourcesPayload(
  value: unknown,
): Record<string, ResourceBinding | null> {
  const entries: Record<string, ResourceBinding | null> = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      const binding = readResourceBinding(item);
      if (binding) {
        entries[binding.id] = binding;
      }
    }
    return entries;
  }
  if (!value || typeof value !== "object") {
    return entries;
  }
  for (const [id, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === null) {
      if (isResourceId(id)) {
        entries[id] = null;
      }
      continue;
    }
    const binding = readResourceBinding(item, id);
    if (binding) {
      entries[id] = { ...binding, id };
    }
  }
  return entries;
}

function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower.startsWith("127.")
  );
}

function urlHost(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) {
    return null;
  }
  const candidate = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    return new URL(candidate).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Whether a runtime at `runtimeUrl` (or a browser runtime when absent) runs on
 * a different machine from a loopback resource binding.
 *
 * A binding on `127.0.0.1` or `localhost` is on this client's machine. A
 * browser runtime or a remote runtime on `127.0.0.1` / `localhost` /
 * `hkp://remotes/…` runs on the same machine and can dial it; a runtime on
 * another host cannot, and is told so rather than handed an address that dials
 * its own loopback.
 */
export function bindingForRuntime(
  binding: ResourceBinding,
  runtime?: { type?: string; url?: string },
): ResourceBinding {
  if (binding.unreachable) {
    return binding;
  }
  const address = binding.kind === "s3" ? binding.endpoint : binding.url;
  const resourceHost = urlHost(address);
  if (!resourceHost || !isLoopbackHost(resourceHost)) {
    return binding;
  }
  if (!runtime || runtime.type === "browser" || !runtime.url) {
    return binding;
  }
  if (runtime.url.startsWith("hkp://")) {
    return binding;
  }
  const runtimeHost = urlHost(runtime.url);
  if (!runtimeHost || isLoopbackHost(runtimeHost)) {
    return binding;
  }
  return {
    ...binding,
    unreachable: `resource "${binding.id}" is bound to ${resourceHost} on this machine, which runtime "${runtime.url}" cannot reach`,
  };
}

/**
 * Resolves a `hkp-resource://<id>` reference against a list of bindings,
 * optionally checking that the resource is of the expected `kind`.
 */
export function resolveResource<K extends ResourceKind = ResourceKind>(
  bindings: ResourceBinding[],
  reference: string,
  expectedKind?: K,
): ResourceResolution<Extract<ResolvedResource, { kind: K }>> {
  const id = parseResourceRef(reference);
  if (!id) {
    return {
      resource: null,
      problem: `${JSON.stringify(reference)} is not a resource reference`,
    };
  }
  const binding = bindings.find((entry) => entry.id === id);
  if (!binding) {
    return {
      resource: null,
      problem: `resource "${id}" is not bound`,
    };
  }
  if (expectedKind && binding.kind !== expectedKind) {
    return {
      resource: null,
      problem: `resource "${id}" is of kind "${binding.kind}", not "${expectedKind}"`,
    };
  }
  if (binding.unreachable) {
    return {
      resource: null,
      problem: binding.unreachable,
    };
  }
  const { unreachable: _unreachable, ...resolved } = binding;
  return {
    resource: resolved as Extract<ResolvedResource, { kind: K }>,
    problem: "",
  };
}

/** The list with `resource` in place of the one it replaces, or appended. */
export function upsertResource(
  resources: ResourceDescriptor[] | undefined,
  resource: ResourceDescriptor,
  replacing: string = resource.id,
): ResourceDescriptor[] {
  const list = resources ?? [];
  const index = list.findIndex((entry) => entry.id === replacing);
  if (index < 0) {
    return [...list, resource];
  }
  return list.map((entry, at) => (at === index ? resource : entry));
}

/** An id not yet taken, derived from `base`. */
export function uniqueResourceId(
  resources: ResourceDescriptor[] | undefined,
  base: string,
): string {
  const stem =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "resource";
  const taken = new Set((resources ?? []).map((resource) => resource.id));
  if (!taken.has(stem)) {
    return stem;
  }
  for (let n = 2; ; n++) {
    if (!taken.has(`${stem}-${n}`)) {
      return `${stem}-${n}`;
    }
  }
}
