/**
 * Blocks: a configured service — usually a sub-service and its pipeline —
 * defined once in a board and used wherever the board needs it.
 *
 * A definition is shaped like a preset (`serviceId`, `name`, `state`) plus the
 * parameters it takes. A use is an entry in any pipeline that names the block
 * instead of a service:
 *
 * ```json
 * "blocks": [
 *   { "id": "note", "name": "Note", "serviceId": "sub-service",
 *     "params": { "trigger": "hihat", "volume": 0.5, "beats": 0.5 },
 *     "state": { "pipeline": [
 *       { "serviceId": "hookup.to/service/sound", "instanceId": "hit",
 *         "state": { "trigger": "{{param.trigger}}", "volume": "{{param.volume}}" } },
 *       { "serviceId": "hookup.to/service/timer", "instanceId": "wait",
 *         "state": { "oneShotDelay": "{{param.beats}}", "oneShotDelayUnit": "beats" } } ] } }
 * ]
 *
 * { "block": "note", "instanceId": "kick", "params": { "trigger": "kick", "volume": 0.9 } }
 * ```
 *
 * No runtime knows blocks exist. Linking expands every use into the service it
 * stands for, so what is provisioned is an ordinary board; saving collapses
 * each expansion back into the use it came from — as long as what is running
 * is still what the use produces. A use whose inside was changed is written
 * back expanded: it has broken off into a copy of its own, and the definition
 * and every other use of it are untouched. Renaming a use is not a change to
 * its inside and keeps it a use.
 *
 * A parameter referred to by a whole string (`"{{param.volume}}"`) takes the
 * parameter's value, of whatever type it is; one inside a longer string is
 * written into it as text. Parameters do not reach into the blocks a
 * definition uses — a nested use is handed what it needs through its own
 * `params`, which may themselves refer to the outer block's parameters.
 */

import { BoardDescriptor, RuntimeServiceMap } from "../../types";
import { Diagnostic } from "./units";

export type BlockDefinition = {
  id: string;
  name: string;
  serviceId: string;
  /** Names each use, unless the use names itself. Defaults to `name`. */
  serviceName?: string;
  description?: string;
  /** Every parameter the block takes, and the value it has when a use is silent. */
  params?: Record<string, unknown>;
  state: Record<string, unknown>;
};

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
 * by id wherever they have one, so a service inserted before a use does not
 * lose track of it.
 */
export type BlockPathStep = string | number | { id: string };

/** A use as it was expanded, and where. */
export type PlacedBlock = {
  /** From the board's service map to the expanded entry. */
  path: BlockPathStep[];
  /** The use as the document wrote it, which is what saving puts back. */
  use: BlockUse;
  /** The id the expansion carries — the use's own, or one given to it. */
  id: string;
};

export type BlockLinkage = {
  definitions: BlockDefinition[];
  placed: PlacedBlock[];
};

export type BlockExpansion = {
  services: RuntimeServiceMap;
  placed: PlacedBlock[];
  diagnostics: Diagnostic[];
};

export function isBlockUse(value: unknown): value is BlockUse {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as any).block === "string" &&
    (value as any).serviceId === undefined
  );
}

const WHOLE_PARAM = /^\{\{\s*param\.([A-Za-z0-9_.-]+)\s*\}\}$/;
const PARAM = /\{\{\s*param\.([A-Za-z0-9_.-]+)\s*\}\}/g;

/**
 * Substitutes parameters anywhere in a structure. A reference with no value is
 * left as it stands and named in `missing`, the way a unit's parameters are.
 */
export function substituteBlockParams<T>(
  value: T,
  params: Record<string, unknown>,
  missing: Set<string>,
): T {
  const walk = (current: unknown): unknown => {
    if (typeof current === "string") {
      const whole = current.match(WHOLE_PARAM);
      if (whole) {
        if (whole[1] in params) {
          return params[whole[1]];
        }
        missing.add(whole[1]);
        return current;
      }
      return current.replace(PARAM, (reference, name: string) => {
        if (name in params) {
          return String(params[name]);
        }
        missing.add(name);
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

/**
 * What one use produces, one level deep: the definition's service with the
 * use's parameters in it. Uses nested in the definition stay uses.
 */
function instantiate(
  definition: BlockDefinition,
  use: BlockUse,
  id: string,
  topLevel: boolean,
  missing: Set<string>,
): Record<string, unknown> {
  const params = { ...definition.params, ...use.params };
  return {
    // A runtime's own services are addressed by `uuid`, entries of a nested
    // pipeline by `instanceId`.
    ...(topLevel ? { uuid: id } : { instanceId: id }),
    serviceId: definition.serviceId,
    serviceName: use.serviceName ?? definition.serviceName ?? definition.name,
    state: substituteBlockParams(definition.state, params, missing),
  };
}

/** Expands every use of a block in a board's services. */
export function expandBlocks(
  services: RuntimeServiceMap,
  definitions: BlockDefinition[],
): BlockExpansion {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const placed: PlacedBlock[] = [];
  const diagnostics: Diagnostic[] = [];

  const expandUse = (
    use: BlockUse,
    index: number,
    arrayPath: BlockPathStep[],
    stack: string[],
  ): unknown => {
    const definition = byId.get(use.block);
    if (!definition) {
      diagnostics.push({
        level: "error",
        code: "block-unknown",
        message: `No block "${use.block}" is defined in this board.`,
      });
      return use;
    }
    if (stack.includes(definition.id)) {
      diagnostics.push({
        level: "error",
        code: "block-cycle",
        message: `Block "${definition.id}" uses itself: ${[...stack, definition.id].join(" → ")}.`,
      });
      return use;
    }
    const id = use.instanceId ?? use.uuid ?? `${use.block}-${index}`;
    const missing = new Set<string>();
    const instance = instantiate(
      definition,
      use,
      id,
      arrayPath.length === 1,
      missing,
    );
    for (const name of missing) {
      diagnostics.push({
        level: "warning",
        code: "block-param-missing",
        message: `Block "${definition.id}" refers to parameter "${name}", which has no value; the reference is left in place.`,
      });
    }
    const path = [...arrayPath, { id }];
    placed.push({ path, use, id });
    instance.state = walk(instance.state, [...path, "state"], [
      ...stack,
      definition.id,
    ]);
    return instance;
  };

  const walk = (
    value: unknown,
    path: BlockPathStep[],
    stack: string[],
  ): any => {
    if (Array.isArray(value)) {
      return value.map((element, index) => {
        if (isBlockUse(element)) {
          return expandUse(element, index, path, stack);
        }
        const id = entryId(element);
        return walk(element, [...path, id ? { id } : index], stack);
      });
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [
          key,
          walk(inner, [...path, key], stack),
        ]),
      );
    }
    return value;
  };

  const expanded = Object.fromEntries(
    Object.entries(services).map(([runtimeId, list]) => [
      runtimeId,
      walk(list, [runtimeId], []),
    ]),
  ) as RuntimeServiceMap;
  return { services: expanded, placed, diagnostics };
}

/**
 * Whether what is running still says everything the expansion said.
 *
 * Keys the expansion does not mention are what a service reports beyond its
 * configuration — defaults, counters, whether a timer is running — and do not
 * count, with one exception: a service bypassed inside a use is a change to
 * it, whether or not the definition says anything about bypassing.
 */
function stillExpansion(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((element, index) => stillExpansion(element, actual[index]))
    );
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      return false;
    }
    const reported = actual as Record<string, unknown>;
    if (reported.bypass === true && (expected as any).bypass !== true) {
      return false;
    }
    return Object.entries(expected).every(([key, inner]) =>
      stillExpansion(inner, reported[key]),
    );
  }
  return expected === actual;
}

function resolveStep(
  container: unknown,
  step: BlockPathStep,
): { parent: any; key: string | number } | undefined {
  if (typeof step === "object") {
    if (!Array.isArray(container)) {
      return undefined;
    }
    const index = container.findIndex((element) => entryId(element) === step.id);
    return index < 0 ? undefined : { parent: container, key: index };
  }
  if (!container || typeof container !== "object") {
    return undefined;
  }
  return { parent: container, key: step };
}

function locate(
  root: unknown,
  path: BlockPathStep[],
): { parent: any; key: string | number } | undefined {
  let current = root;
  let found: { parent: any; key: string | number } | undefined;
  for (const step of path) {
    found = resolveStep(current, step);
    if (!found) {
      return undefined;
    }
    current = found.parent[found.key];
  }
  return found;
}

/**
 * Writes each expansion that is still what its use produces back as that use.
 *
 * Innermost first, so that a block whose inside was changed — and is therefore
 * written back expanded, as a copy of its own — still carries the uses nested
 * in it that nobody touched.
 */
export function collapseBlocks(
  services: RuntimeServiceMap,
  linkage: BlockLinkage,
): RuntimeServiceMap {
  const byId = new Map(
    linkage.definitions.map((definition) => [definition.id, definition]),
  );
  const collapsed = structuredClone(services) as RuntimeServiceMap;
  const innermostFirst = [...linkage.placed].sort(
    (a, b) => b.path.length - a.path.length,
  );
  for (const { path, use, id } of innermostFirst) {
    const definition = byId.get(use.block);
    const at = locate(collapsed, path);
    if (!definition || !at) {
      // Removed, or moved somewhere this use does not know about. Whatever is
      // there now is written as it is.
      continue;
    }
    const actual = at.parent[at.key];
    const expected = instantiate(definition, use, id, path.length === 2, new Set());
    const { serviceName: expectedName, ...expectedRest } = expected;
    if (!stillExpansion(expectedRest, actual)) {
      continue;
    }
    const renamed =
      typeof actual?.serviceName === "string" && actual.serviceName !== expectedName;
    at.parent[at.key] = renamed ? { ...use, serviceName: actual.serviceName } : use;
  }
  return collapsed;
}

/** A board's services with its blocks expanded, and what saving needs to undo it. */
export function linkBlocks(board: BoardDescriptor): {
  board: BoardDescriptor;
  linkage?: BlockLinkage;
  diagnostics: Diagnostic[];
} {
  const definitions = board.blocks ?? [];
  if (!definitions.length) {
    return { board, diagnostics: [] };
  }
  const { services, placed, diagnostics } = expandBlocks(
    board.services ?? {},
    definitions,
  );
  const { blocks: _definitions, ...rest } = board;
  return {
    board: { ...rest, services },
    linkage: { definitions, placed },
    diagnostics,
  };
}

/** The inverse of `linkBlocks`, applied to a serialised board. */
export function unlinkBlocks<T extends BoardDescriptor>(
  board: T,
  linkage: BlockLinkage | undefined,
): T {
  if (!linkage) {
    return board;
  }
  return {
    ...board,
    blocks: linkage.definitions,
    services: collapseBlocks(board.services ?? {}, linkage),
  };
}
