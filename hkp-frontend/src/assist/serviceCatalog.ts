import BrowserRegistry from "../runtime/browser/BrowserRegistry";
import { defaultBundles } from "../runtime/browser/registry/Default";
import { BoardDescriptor, RuntimeDescriptor } from "../types";

/**
 * Which services a proposal may name, per runtime: a service id a runtime does
 * not have fails only once the board loads — a browser runtime drops it with a
 * console line, a runtime server refuses the whole runtime — and by then the
 * board it would replace is gone. Checked with the proposal instead, a made-up
 * id is something the model is told and corrects in the same turn.
 *
 * A runtime is checked only where what it has is known: the runtime the board
 * already runs under that id, on the same engine; or any browser runtime,
 * whose registry is this client's own. A new runtime on a server is not — its
 * server answers for it when it is created.
 */

type Json = Record<string, unknown>;

function object(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The board's running runtimes and the service ids each one has. */
export type RunningCatalog = {
  runtimes: RuntimeDescriptor[];
  registry: Record<string, Array<{ serviceId: string }>>;
};

/** One entry naming a service its runtime does not have. */
export type UnknownService = {
  runtimeId: string;
  uuid: string;
  serviceId: string;
};

const sameEngine = (a: RuntimeDescriptor, b: Json) =>
  a.type === b.type && (a.url ?? "") === (b.url ?? "") && (a.remote ?? "") === (b.remote ?? "");

/** The service ids `runtime` has, or undefined where that is not known here. */
async function knownServices(
  runtime: Json,
  running: RunningCatalog,
): Promise<Set<string> | undefined> {
  const current = running.runtimes.find((rt) => rt.id === runtime.id);
  const listed = current && running.registry[current.id];
  if (current && listed?.length && sameEngine(current, runtime))
    return new Set(listed.map((svc) => svc.serviceId));
  if (runtime.type !== "browser") return undefined;
  const bundles = Array.isArray(runtime.bundles) ? runtime.bundles : defaultBundles;
  const registry = await BrowserRegistry.create(bundles);
  return new Set(registry.allServices().map((svc) => svc.serviceId));
}

/** Every service entry of a pipeline, nested pipelines included. */
function* entries(pipeline: unknown): Generator<Json> {
  if (!Array.isArray(pipeline)) return;
  for (const entry of pipeline) {
    if (!object(entry)) continue;
    yield entry;
    const state = entry.state;
    if (!object(state)) continue;
    yield* entries(state.pipeline);
    if (Array.isArray(state.cases))
      for (const branch of state.cases)
        if (object(branch)) yield* entries(branch.pipeline);
    yield* entries(state.default);
  }
}

/**
 * The entries of `board` that name a service their runtime does not have,
 * leaving out those the board already had: a proposal is held to what it adds,
 * as its facade is.
 */
export async function unknownServices(
  board: BoardDescriptor,
  running: RunningCatalog,
  base?: BoardDescriptor,
): Promise<UnknownService[]> {
  const key = (u: UnknownService) => `${u.runtimeId}\n${u.uuid}\n${u.serviceId}`;
  const found = await findUnknown(board, running);
  if (!base || !found.length) return found;
  const before = new Set((await findUnknown(base, running)).map(key));
  return found.filter((u) => !before.has(key(u)));
}

async function findUnknown(
  board: BoardDescriptor,
  running: RunningCatalog,
): Promise<UnknownService[]> {
  const unknown: UnknownService[] = [];
  for (const runtime of board.runtimes as unknown as Json[]) {
    const known = await knownServices(runtime, running);
    if (!known) continue;
    const runtimeId = String(runtime.id);
    for (const entry of entries(board.services[runtimeId])) {
      // A block use stands for its definition, which is checked where it is
      // defined; only a service names a registry entry.
      if (typeof entry.serviceId !== "string" || known.has(entry.serviceId))
        continue;
      unknown.push({
        runtimeId,
        uuid: String(entry.uuid ?? entry.instanceId ?? ""),
        serviceId: entry.serviceId,
      });
    }
  }
  return unknown;
}

/** What to tell the model, or the person, about entries no runtime has. */
export function describeUnknownServices(unknown: UnknownService[]) {
  return `These services do not exist in their runtime: ${unknown
    .map(
      ({ runtimeId, uuid, serviceId }) =>
        `"${serviceId}" (${uuid || "unnamed"} in runtime ${runtimeId})`,
    )
    .join(", ")}. Use only service ids from serviceCatalog in the board context or from the service documentation.`;
}
