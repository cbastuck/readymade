/**
 * Blocks: a configured sub-service and its pipeline, defined once in a board
 * and used wherever a pipeline names it. Only a sub-service: a use is
 * refreshed by configuring it with its definition, which rebuilds a
 * sub-service's pipeline but only patches any other service
 * (see `parseBlockDefinition`).
 *
 * A definition is a preset used by reference instead of copied: `serviceId`,
 * `name`, `state`, plus the `params` its state refers to as `{{param.x}}`. A
 * **use** is an entry in any pipeline that names a block instead of a service:
 *
 * ```json
 * { "block": "note", "instanceId": "kick", "params": { "trigger": "kick" } }
 * ```
 *
 * No runtime knows blocks exist. Linking expands every use into the service it
 * stands for, so what is provisioned is an ordinary board.
 *
 * **A use is frozen while the board runs.** Its inside belongs to its
 * definition: the board locks it on screen and refuses addresses into it. What
 * varies per use is its params, changed through `withUseParams`, which
 * re-instantiates that use. Saving therefore writes each use back as linkage
 * holds it — the use as authored, with whatever params were set since —
 * without comparing it to what is running. Anything a service inside a use
 * reports beyond that is live only. To vary one use beyond its params it is
 * **detached** (`detachUse`): it becomes an ordinary copy, and saves as
 * whatever is running.
 *
 * Definitions are per document. The board being opened has its own, and each
 * unit placed into it keeps its own, so a unit's uses resolve against the
 * unit's blocks and never against the composition's.
 */

import type { BlockDefinition } from "../../core/presets";
import { RuntimeServiceMap, toCanonicalServiceId } from "../../types";
import { substituteParams, referencedParams } from "./params";
import { Diagnostic } from "./units";

export type { BlockDefinition };

/** An entry in a pipeline that stands for a block. */
export type BlockUse = {
  block: string;
  instanceId?: string;
  uuid?: string;
  serviceName?: string;
  params?: Record<string, unknown>;
};

/**
 * One step towards an entry: a key into an object, a position in an array, or
 * the entry in an array carrying that `instanceId` / `uuid`. Entries are found
 * by id wherever they have one, so a service inserted before a use, or a use
 * moved within its pipeline, does not lose track of it.
 */
export type BlockPathStep = string | number | { id: string };

/** Which document a definition belongs to: `""` for the board being opened, else a unit's name. */
export type BlockDocument = string;

/** A use as it was expanded, and where. */
export type PlacedBlock = {
  /** Identifies this placement; stable for as long as the use stays where it is. */
  key: string;
  runtimeId: string;
  /** From the board's service map to the expanded entry. */
  path: BlockPathStep[];
  /** The dotted address a board dials to reach the expanded service. */
  address: string;
  /** The id the expansion carries — the use's own, or one given to it. */
  id: string;
  /** The use as the document wrote it, with the params set on it since. */
  use: BlockUse;
  /** The placement of the use this one sits inside, when it sits inside one. */
  parent?: string;
  document: BlockDocument;
};

export type BlockLinkage = {
  definitions: { [document: BlockDocument]: BlockDefinition[] };
  placed: PlacedBlock[];
  /**
   * The placement of the one use unlocked as a working copy of its block's
   * definition, while the definition is being edited on it. Saving meanwhile
   * writes the use back as it stands; only applying changes the definition.
   */
  editing?: string;
};

/** Everything a use may say; an object saying anything else is data. */
const USE_KEYS = new Set(["block", "instanceId", "uuid", "serviceName", "params"]);

export function isBlockUse(value: unknown): value is BlockUse {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as any).block === "string" &&
    Object.keys(value).every((key) => USE_KEYS.has(key))
  );
}

function entryId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const { instanceId, uuid } = value as { instanceId?: unknown; uuid?: unknown };
  if (typeof instanceId === "string") {
    return instanceId;
  }
  return typeof uuid === "string" ? uuid : undefined;
}

function pathKey(path: BlockPathStep[]): string {
  return JSON.stringify(path);
}

/** The ids along a path, joined the way scoped addresses are. */
function addressOf(path: BlockPathStep[]): string {
  return path
    .slice(1)
    .filter((step): step is { id: string } => typeof step === "object")
    .map((step) => step.id)
    .join(".");
}

/**
 * An id for a use written without one, unlike any id beside it. Derived from
 * the block's name and the order of uses, so the same document expands to the
 * same ids every time it is opened — and never written back, since saving puts
 * the use back as it was written.
 */
function freshId(block: string, taken: Set<string>): string {
  const base = block.replace(/[^A-Za-z0-9_-]+/g, "-") || "block";
  for (let n = 1; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

/** The name an expanded use carries. */
function nameOfUse(definition: BlockDefinition, use: BlockUse): string {
  return use.serviceName ?? definition.serviceName ?? definition.name;
}

/**
 * What a sub-service is when its state does not say otherwise, in every
 * runtime. A sub-service takes these fields as a patch — only its pipeline is
 * rebuilt — so a use is configured with each of them named: re-instantiating
 * one after its working copy changed a field the definition leaves out puts
 * that field back.
 */
const SUB_SERVICE_DEFAULTS = {
  mode: "pipeline",
  stopPropagation: false,
  scope: { slots: "own" },
};

/**
 * What one use produces, one level deep: the definition's service with the
 * use's params in it. Uses nested in the definition stay uses.
 */
function instantiate(
  definition: BlockDefinition,
  use: BlockUse,
  id: string,
  topLevel: boolean,
  missing: Set<string>,
): Record<string, any> {
  const params = { ...definition.params, ...use.params };
  const state = substituteParams(definition.state, params, missing);
  return {
    // A runtime's own services are addressed by `uuid`, entries of a nested
    // pipeline by `instanceId`.
    ...(topLevel ? { uuid: id } : { instanceId: id }),
    serviceId: definition.serviceId,
    serviceName: nameOfUse(definition, use),
    state:
      toCanonicalServiceId(definition.serviceId) === "sub-service"
        ? { ...SUB_SERVICE_DEFAULTS, ...state }
        : state,
  };
}

type Expansion = {
  placed: PlacedBlock[];
  diagnostics: Diagnostic[];
};

type Context = {
  runtimeId: string;
  document: BlockDocument;
  definitions: Map<string, BlockDefinition>;
  out: Expansion;
};

function expandUse(
  use: BlockUse,
  id: string,
  arrayPath: BlockPathStep[],
  stack: string[],
  parent: string | undefined,
  ctx: Context,
): unknown {
  const where = ctx.document ? { unit: ctx.document } : {};
  const definition = ctx.definitions.get(use.block);
  if (!definition) {
    ctx.out.diagnostics.push({
      level: "error",
      code: "block-unknown",
      block: use.block,
      message: `No block "${use.block}" is defined in this board.`,
      ...where,
    });
    return use;
  }
  if (stack.includes(definition.id)) {
    ctx.out.diagnostics.push({
      level: "error",
      code: "block-cycle",
      block: definition.id,
      message: `Block "${definition.id}" uses itself: ${[...stack, definition.id].join(" → ")}.`,
      ...where,
    });
    return use;
  }
  for (const name of Object.keys(use.params ?? {})) {
    if (!(name in (definition.params ?? {}))) {
      ctx.out.diagnostics.push({
        level: "warning",
        code: "block-param-undeclared",
        block: definition.id,
        message: `A use of block "${definition.id}" passes "${name}", which the block does not declare.`,
        ...where,
      });
    }
  }
  const missing = new Set<string>();
  const instance = instantiate(definition, use, id, arrayPath.length === 1, missing);
  for (const name of missing) {
    ctx.out.diagnostics.push({
      level: "warning",
      code: "block-param-missing",
      block: definition.id,
      message: `Block "${definition.id}" refers to parameter "${name}", which has no value; the reference is left in place.`,
      ...where,
    });
  }
  const path = [...arrayPath, { id }];
  const key = pathKey(path);
  ctx.out.placed.push({
    key,
    runtimeId: ctx.runtimeId,
    path,
    address: addressOf(path),
    id,
    use,
    parent,
    document: ctx.document,
  });
  instance.state = walk(instance.state, [...path, "state"], [...stack, definition.id], key, ctx);
  return instance;
}

function walk(
  value: unknown,
  path: BlockPathStep[],
  stack: string[],
  parent: string | undefined,
  ctx: Context,
): any {
  if (Array.isArray(value)) {
    const taken = new Set(
      value.map(entryId).filter((id): id is string => !!id),
    );
    // A runtime's own list holds nothing but services, so a use there is one
    // whatever the document defines. Deeper, an array may as well be data a
    // service holds, and is read for uses only in a document that has blocks.
    const usesHere = path.length === 1 || ctx.definitions.size > 0;
    return value.map((element, index) => {
      if (usesHere && isBlockUse(element)) {
        const id = element.instanceId ?? element.uuid ?? freshId(element.block, taken);
        return expandUse(element, id, path, stack, parent, ctx);
      }
      const id = entryId(element);
      return walk(element, [...path, id ? { id } : index], stack, parent, ctx);
    });
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        walk(inner, [...path, key], stack, parent, ctx),
      ]),
    );
  }
  return value;
}

function definitionMap(definitions: BlockDefinition[] | undefined) {
  return new Map((definitions ?? []).map((definition) => [definition.id, definition]));
}

/**
 * Checks a document's definitions on their own: every parameter a definition
 * refers to should be one it declares, so that a use can see what it may pass.
 */
function checkDefinitions(
  definitions: BlockDefinition[],
  document: BlockDocument,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      diagnostics.push({
        level: "error",
        code: "block-duplicate",
        block: definition.id,
        message: `Block "${definition.id}" is defined more than once.`,
        ...(document ? { unit: document } : {}),
      });
    }
    seen.add(definition.id);
    for (const name of referencedParams(definition.state)) {
      if (!(name in (definition.params ?? {}))) {
        diagnostics.push({
          level: "warning",
          code: "block-param-undeclared",
          block: definition.id,
          message: `Block "${definition.id}" refers to parameter "${name}" without declaring it.`,
          ...(document ? { unit: document } : {}),
        });
      }
    }
  }
  return diagnostics;
}

/**
 * Expands every use in a board's services.
 *
 * `documentOf` says which document a runtime came from — the board being
 * opened, or the unit that contributed it — and so whose definitions its uses
 * resolve against.
 */
export function expandBlocks(
  services: RuntimeServiceMap,
  definitions: BlockLinkage["definitions"],
  documentOf: (runtimeId: string) => BlockDocument = () => "",
): { services: RuntimeServiceMap; placed: PlacedBlock[]; diagnostics: Diagnostic[] } {
  const out: Expansion = { placed: [], diagnostics: [] };
  for (const [document, list] of Object.entries(definitions)) {
    out.diagnostics.push(...checkDefinitions(list, document));
  }
  const byDocument = new Map(
    Object.entries(definitions).map(([document, list]) => [document, definitionMap(list)]),
  );
  const expanded = Object.fromEntries(
    Object.entries(services).map(([runtimeId, list]) => {
      const document = documentOf(runtimeId);
      const ctx: Context = {
        runtimeId,
        document,
        definitions: byDocument.get(document) ?? new Map(),
        out,
      };
      return [runtimeId, walk(list, [runtimeId], [], undefined, ctx)];
    }),
  ) as RuntimeServiceMap;
  return { services: expanded, ...out };
}

/** The uses nothing attached contains: the ones saving writes back, and a person may detach. */
export function outermostUses(linkage: BlockLinkage): PlacedBlock[] {
  const keys = new Set(linkage.placed.map((placed) => placed.key));
  return linkage.placed.filter((placed) => !placed.parent || !keys.has(placed.parent));
}

/** The attached use expanded at exactly this address, if there is one. */
export function blockUseAt(
  linkage: BlockLinkage | undefined,
  address: string,
  runtimeId?: string,
): PlacedBlock | undefined {
  return linkage?.placed.find(
    (placed) =>
      placed.address === address && (!runtimeId || placed.runtimeId === runtimeId),
  );
}

/**
 * The attached use an address reaches *inside* of, if any — which is an
 * address the board refuses: a use's inside belongs to its definition. Not the
 * working copy a block is being edited on, whose inside is open for editing.
 */
export function blockUseContaining(
  linkage: BlockLinkage | undefined,
  address: string,
  runtimeId?: string,
): PlacedBlock | undefined {
  return linkage?.placed.find(
    (placed) =>
      placed.key !== linkage.editing &&
      !!placed.address &&
      address.startsWith(`${placed.address}.`) &&
      (!runtimeId || placed.runtimeId === runtimeId),
  );
}

function descendantsOf(placed: PlacedBlock[], key: string): Set<string> {
  const found = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of placed) {
      if (
        entry.parent &&
        (entry.parent === key || found.has(entry.parent)) &&
        !found.has(entry.key)
      ) {
        found.add(entry.key);
        grew = true;
      }
    }
  }
  return found;
}

function ancestorBlocks(linkage: BlockLinkage, placed: PlacedBlock): string[] {
  const byKey = new Map(linkage.placed.map((entry) => [entry.key, entry]));
  const stack: string[] = [];
  for (let at = placed.parent && byKey.get(placed.parent); at; at = at.parent && byKey.get(at.parent)) {
    stack.unshift(at.use.block);
  }
  return stack;
}

/**
 * A use re-instantiated with new params: the service it now expands to, ready
 * to configure the running one with, and the linkage that saving will write.
 *
 * Uses nested in it are expanded afresh, since the params may change what they
 * are given, or which block they name.
 */
export function withUseParams(
  linkage: BlockLinkage,
  key: string,
  params: Record<string, unknown>,
): { linkage: BlockLinkage; service: Record<string, any>; diagnostics: Diagnostic[] } {
  const placed = linkage.placed.find((entry) => entry.key === key);
  if (!placed) {
    throw new Error(`No use of a block is placed at ${key}`);
  }
  const replaced = descendantsOf(linkage.placed, key).add(key);
  const out: Expansion = { placed: [], diagnostics: [] };
  const ctx: Context = {
    runtimeId: placed.runtimeId,
    document: placed.document,
    definitions: definitionMap(linkage.definitions[placed.document]),
    out,
  };
  const use = { ...placed.use, params };
  const service = expandUse(
    use,
    placed.id,
    placed.path.slice(0, -1),
    ancestorBlocks(linkage, placed),
    placed.parent,
    ctx,
  ) as Record<string, any>;
  return {
    linkage: {
      ...linkage,
      placed: [
        ...linkage.placed.filter((entry) => !replaced.has(entry.key)),
        ...out.placed,
      ],
    },
    service,
    diagnostics: out.diagnostics,
  };
}

/**
 * Turns one use into an ordinary copy of what it expanded to. Only a use
 * nothing attached contains: inside an attached use, everything is locked.
 * The uses inside the detached one stay attached.
 */
export function detachUse(linkage: BlockLinkage, key: string): BlockLinkage {
  const placed = linkage.placed.find((entry) => entry.key === key);
  if (!placed) {
    throw new Error(`No use of a block is placed at ${key}`);
  }
  if (!outermostUses(linkage).includes(placed)) {
    throw new Error(
      `The use at "${placed.address}" is inside another use; detach that one first`,
    );
  }
  return { ...linkage, placed: linkage.placed.filter((entry) => entry !== placed) };
}

/**
 * Arrays and plain objects copied, everything else shared. Not
 * `structuredClone`: a descriptor a runtime hands back may carry the function
 * its service is made with, which cannot be cloned and need not be.
 */
function copyTree(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(copyTree);
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, copyTree(inner)]),
    );
  }
  return value;
}

function locate(
  root: unknown,
  path: BlockPathStep[],
): { parent: any; key: string | number } | undefined {
  let current: any = root;
  let found: { parent: any; key: string | number } | undefined;
  for (const step of path) {
    if (typeof step === "object") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      const index = current.findIndex((element) => entryId(element) === step.id);
      if (index < 0) {
        return undefined;
      }
      found = { parent: current, key: index };
    } else {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      found = { parent: current, key: step };
    }
    current = found.parent[found.key];
  }
  return found;
}

/**
 * Writes each outermost attached use back as linkage holds it, in place of
 * what it expanded to. Nothing is compared: a use's inside cannot have been
 * edited, so what is running there says nothing the use does not.
 *
 * The one thing taken from the running board is the use's name, which a
 * person renames on the use itself, not inside it. A use no longer where it
 * was placed — removed, or moved to another pipeline — is written as whatever
 * is there now.
 *
 * `documents` limits it to the uses of those documents — a board that is
 * handed on flat keeps its own blocks, but has no way to carry a unit's.
 */
export function collapseBlocks(
  services: RuntimeServiceMap,
  linkage: BlockLinkage,
  documents?: BlockDocument[],
): RuntimeServiceMap {
  const collapsed = copyTree(services) as RuntimeServiceMap;
  for (const placed of outermostUses(linkage)) {
    if (documents && !documents.includes(placed.document)) {
      continue;
    }
    const at = locate(collapsed, placed.path);
    if (!at) {
      continue;
    }
    const running = at.parent[at.key];
    const definition = definitionMap(linkage.definitions[placed.document]).get(
      placed.use.block,
    );
    const renamed =
      !!definition &&
      typeof running?.serviceName === "string" &&
      running.serviceName !== nameOfUse(definition, placed.use);
    at.parent[at.key] = renamed
      ? { ...placed.use, serviceName: running.serviceName }
      : placed.use;
  }
  return collapsed;
}

/**
 * Where the entry an address names sits in a board's services — the path a
 * placement records. The first runtime holding it, unless one is named.
 */
export function findEntryPath(
  services: RuntimeServiceMap,
  address: string,
  runtimeId?: string,
): BlockPathStep[] | undefined {
  const search = (value: unknown, path: BlockPathStep[]): BlockPathStep[] | undefined => {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const id = entryId(value[index]);
        const here = [...path, id ? { id } : index];
        if (id && addressOf(here) === address) {
          return here;
        }
        const found = search(value[index], here);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    if (value && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) {
        const found = search(inner, [...path, key]);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };
  for (const [id, list] of Object.entries(services)) {
    if (runtimeId && id !== runtimeId) {
      continue;
    }
    const found = search(list, [id]);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * A new use placed into a pipeline: what it expands to, ready to create the
 * running service from, and the linkage that saving will write it back from.
 */
export function withNewUse(
  linkage: BlockLinkage,
  where: {
    runtimeId: string;
    document: BlockDocument;
    /** The path to the pipeline the use goes into. */
    arrayPath: BlockPathStep[];
    use: BlockUse;
    id: string;
  },
): { linkage: BlockLinkage; service: Record<string, any>; diagnostics: Diagnostic[] } {
  const out: Expansion = { placed: [], diagnostics: [] };
  const ctx: Context = {
    runtimeId: where.runtimeId,
    document: where.document,
    definitions: definitionMap(linkage.definitions[where.document]),
    out,
  };
  const service = expandUse(where.use, where.id, where.arrayPath, [], undefined, ctx) as Record<
    string,
    any
  >;
  return {
    linkage: { ...linkage, placed: [...linkage.placed, ...out.placed] },
    service,
    diagnostics: out.diagnostics,
  };
}

/**
 * A configured service turned into a block: `definition` is added to its
 * document, and the service at `path` becomes the definition's first use —
 * nothing about what runs changes, since the service already is what the use
 * expands to. Uses already inside it become uses inside this one.
 */
export function withBlockFrom(
  linkage: BlockLinkage | undefined,
  where: {
    runtimeId: string;
    document: BlockDocument;
    path: BlockPathStep[];
    definition: BlockDefinition;
  },
): BlockLinkage {
  const current = linkage ?? { definitions: {}, placed: [] };
  const { runtimeId, document, path, definition } = where;
  const last = path[path.length - 1];
  if (typeof last !== "object") {
    throw new Error("withBlockFrom: a block is made from an entry that has an id");
  }
  if ((current.definitions[document] ?? []).some((entry) => entry.id === definition.id)) {
    throw new Error(`A block "${definition.id}" already exists`);
  }
  const key = pathKey(path);
  const prefix = key.slice(0, -1);
  const use: BlockUse = {
    block: definition.id,
    ...(path.length === 2 ? { uuid: last.id } : { instanceId: last.id }),
  };
  return {
    definitions: {
      ...current.definitions,
      [document]: [...(current.definitions[document] ?? []), definition],
    },
    placed: [
      ...current.placed.map((entry) =>
        !entry.parent && entry.runtimeId === runtimeId && entry.key.startsWith(`${prefix},`)
          ? { ...entry, parent: key }
          : entry,
      ),
      { key, runtimeId, path, address: addressOf(path), id: last.id, use, document },
    ],
  };
}

const WHOLE_REFERENCE = /^\{\{\s*param\.([A-Za-z0-9_.-]+)\s*\}\}$/;

/** Every place a definition's state refers to a parameter, found by id where entries have one. */
function paramSites(state: unknown): Array<{ path: BlockPathStep[]; template: string }> {
  const sites: Array<{ path: BlockPathStep[]; template: string }> = [];
  const walkSites = (value: unknown, path: BlockPathStep[]) => {
    if (typeof value === "string") {
      if (referencedParams(value).length) {
        sites.push({ path, template: value });
      }
    } else if (Array.isArray(value)) {
      value.forEach((element, index) => {
        const id = entryId(element);
        walkSites(element, [...path, id ? { id } : index]);
      });
    } else if (value && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) {
        walkSites(inner, [...path, key]);
      }
    }
  };
  walkSites(state, []);
  return sites;
}

/**
 * A definition rewritten from its working copy: the state that is running
 * there, with its parameter references put back.
 *
 * **Param-driven fields belong to the use.** Where the definition held
 * `{{param.x}}` as the whole value, the reference is kept; a value changed
 * there becomes the working copy's param, not the definition's. A reference
 * inside a longer string is kept when the text is what it produced, and
 * otherwise gives way to the new text — there is no telling which part of it
 * the parameter was. A site a structural edit removed loses its parameter.
 */
export function definitionFromWorkingCopy(
  definition: BlockDefinition,
  useParams: Record<string, unknown>,
  running: Record<string, unknown>,
): { definition: BlockDefinition; params: Record<string, unknown>; warnings: string[] } {
  const state = copyTree(running) as Record<string, any>;
  for (const key of Object.keys(state)) {
    if (key.startsWith("__hkp")) {
      delete state[key];
    }
  }
  const values = { ...definition.params, ...useParams };
  const params = { ...useParams };
  const warnings: string[] = [];
  for (const { path, template } of paramSites(definition.state)) {
    const at = path.length ? locate(state, path) : undefined;
    if (!at || at.parent[at.key] === undefined) {
      warnings.push(`"${template}" no longer has a place in the block, and is dropped.`);
      continue;
    }
    const current = at.parent[at.key];
    const whole = template.match(WHOLE_REFERENCE);
    if (whole) {
      if (!Object.is(current, values[whole[1]])) {
        params[whole[1]] = current;
      }
      at.parent[at.key] = template;
    } else if (current === substituteParams(template, values)) {
      at.parent[at.key] = template;
    } else {
      warnings.push(`"${template}" was edited to "${String(current)}", which is kept as written.`);
    }
  }
  return { definition: { ...definition, state }, params, warnings };
}

/**
 * The uses a changed definition has to be re-instantiated through: for every
 * attached use of the block, the outermost attached use containing it — which
 * re-expands everything inside, this block's uses included.
 */
export function usesToRefresh(
  linkage: BlockLinkage,
  block: string,
  document: BlockDocument,
): PlacedBlock[] {
  const byKey = new Map(linkage.placed.map((entry) => [entry.key, entry]));
  const found = new Map<string, PlacedBlock>();
  for (const placed of linkage.placed) {
    if (placed.use.block !== block || placed.document !== document) {
      continue;
    }
    let top = placed;
    for (let up = top.parent && byKey.get(top.parent); up; up = up.parent && byKey.get(up.parent)) {
      top = up;
    }
    found.set(top.key, top);
  }
  return [...found.values()];
}

/** A definition put in place of the one with its id, in its document. */
export function withDefinition(
  linkage: BlockLinkage,
  document: BlockDocument,
  definition: BlockDefinition,
): BlockLinkage {
  return {
    ...linkage,
    definitions: {
      ...linkage.definitions,
      [document]: (linkage.definitions[document] ?? []).map((entry) =>
        entry.id === definition.id ? definition : entry,
      ),
    },
  };
}
