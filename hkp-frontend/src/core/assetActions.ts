/**
 * What editing a board's assets does to the running board.
 *
 * A board's `assets` are the frontend's own document, and changing one is a
 * state update — but the runtimes resolving them hold descriptors of their
 * own, pushed to them. An edit is therefore also a push: the new descriptor to
 * every runtime whose services reference the asset, where the next use picks
 * it up without anything being reconfigured. See `runtime/board/assets`.
 *
 * Only the board's own runtimes are touched. A runtime a unit contributed
 * resolves against that unit's assets, which are edited in the unit.
 */

import {
  RuntimeApi,
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
  toCanonicalRuntimeClassType,
} from "../types";
import {
  AssetCheck,
  AssetDescriptor,
  AssetPush,
  AssetUse,
  findAssetRefs,
  findAssetUses,
  renameAssetRefs,
} from "../runtime/board/assets";

/** The part of a board's engine state the actions read. */
export type AssetBoard = {
  runtimes: RuntimeDescriptor[];
  scopes: { [runtimeId: string]: RuntimeScope };
  services: { [runtimeId: string]: ServiceDescriptor[] };
  runtimeApis: RuntimeApiMap;
};

type LiveService = { uuid: string; serviceName?: string; state?: unknown };

/**
 * A runtime that did not take what it was sent, and what it said. What it was
 * sent says what that leaves: a descriptor it did not take, and it goes on
 * using the one it had; a deletion, and it still holds what the board dropped.
 */
export type AssetPushFailure = {
  runtime: RuntimeDescriptor;
  problem: string;
  push: AssetPush;
};

function apiOf(board: AssetBoard, runtime: RuntimeDescriptor): RuntimeApi | null {
  return (
    board.runtimeApis[runtime.type] ??
    board.runtimeApis[toCanonicalRuntimeClassType(runtime.type)] ??
    null
  );
}

/** The runtimes whose assets are the board's own, rather than a unit's. */
function ownRuntimes(board: AssetBoard): RuntimeDescriptor[] {
  return board.runtimes.filter((runtime) => !runtime.unit);
}

/**
 * What each service on the board's own runtimes is configured with now, asked
 * of the runtime hosting it. The board's copy of a service's state is what it
 * was loaded or last reported with, and a reference typed into a panel since
 * is exactly what *Used by* and a push must not miss.
 */
export async function liveServiceStates(
  board: AssetBoard,
): Promise<{ [runtimeId: string]: LiveService[] }> {
  const entries = await Promise.all(
    ownRuntimes(board).map(async (runtime) => {
      const scope = board.scopes[runtime.id];
      const api = apiOf(board, runtime);
      const services = board.services[runtime.id] ?? [];
      const live = await Promise.all(
        services.map(async (svc) => {
          const state =
            scope && api
              ? await api.getServiceConfig(scope, svc).catch(() => svc.state)
              : svc.state;
          return { uuid: svc.uuid, serviceName: svc.serviceName, state };
        }),
      );
      return [runtime.id, live] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Whether a runtime holds descriptors of its own, which it has to be sent. */
function takesPushes(board: AssetBoard, runtime: RuntimeDescriptor): boolean {
  return !!board.scopes[runtime.id] && !!apiOf(board, runtime)?.pushAssets;
}

/** One push to one runtime that takes them: what went wrong, or null. */
async function pushTo(
  board: AssetBoard,
  runtime: RuntimeDescriptor,
  push: AssetPush,
): Promise<AssetPushFailure | null> {
  const problem = await apiOf(board, runtime)!.pushAssets!(board.scopes[runtime.id], push);
  return problem ? { runtime, problem, push } : null;
}

/** A rewrite that failed and left services on the new id, on these runtimes. */
class StuckRewrite extends Error {
  constructor(
    message: string,
    readonly runtimeIds: string[],
  ) {
    super(message);
  }
}

/**
 * Every place a service on the board's own runtimes names an asset, from what
 * they hold now. The same id in a unit's service names the unit's asset.
 */
export async function assetUses(board: AssetBoard, assetId?: string): Promise<AssetUse[]> {
  return findAssetUses(await liveServiceStates(board), assetId);
}

/**
 * Sends changed descriptors to the runtimes that need them: a new or edited
 * one to each runtime whose services reference it, a deletion (`null`) to
 * every runtime that takes pushes, since which of them were told about it is
 * not recorded anywhere and removing one it never had costs nothing.
 *
 * Returns the runtimes that did not take what they were sent, which nothing
 * else will report: one that missed a descriptor goes on using the one it
 * had, and one that missed a deletion still holds the asset — out of the
 * board, but there for an `asset` service whose input asks for it by name.
 */
export async function pushAssetChanges(
  board: AssetBoard,
  changes: AssetPush,
): Promise<AssetPushFailure[]> {
  if (!Object.keys(changes).length) {
    return [];
  }
  const live = await liveServiceStates(board);
  const failures: AssetPushFailure[] = [];
  await Promise.all(
    ownRuntimes(board).map(async (runtime) => {
      if (!takesPushes(board, runtime)) {
        return;
      }
      const referenced = findAssetRefs((live[runtime.id] ?? []).map((svc) => svc.state));
      const push: AssetPush = {};
      for (const [id, descriptor] of Object.entries(changes)) {
        if (descriptor === null || referenced.includes(id)) {
          push[id] = descriptor;
        }
      }
      if (!Object.keys(push).length) {
        return;
      }
      const failure = await pushTo(board, runtime, push);
      if (failure) {
        failures.push(failure);
      }
    }),
  );
  return failures;
}

/**
 * Rewrites every reference to `from` so it names `to`, by configuring each
 * service holding one with its state rewritten. The one edit to assets that
 * does reconfigure: what a service is configured with changes, not what the
 * reference resolves to. Returns how many services were changed.
 *
 * When a service does not take its new state, the ones already rewritten are
 * configured back and the failure is thrown, so that the board is not left
 * with references under both ids. Putting one back can fail as well; the
 * error then names each service still on the new id.
 */
export async function rewriteAssetRefs(
  board: AssetBoard,
  from: string,
  to: string,
): Promise<number> {
  const live = await liveServiceStates(board);
  const undo: Array<{ label: string; runtimeId: string; back: () => Promise<unknown> }> = [];
  try {
    for (const runtime of ownRuntimes(board)) {
      const scope = board.scopes[runtime.id];
      const api = apiOf(board, runtime);
      if (!scope || !api) {
        continue;
      }
      for (const svc of live[runtime.id] ?? []) {
        const renamed = renameAssetRefs(svc.state, from, to);
        if (renamed === svc.state) {
          continue;
        }
        const label = `${svc.serviceName || svc.uuid} on ${runtime.name}`;
        try {
          await api.configureService(scope, { uuid: svc.uuid }, renamed);
        } catch (err: any) {
          throw new Error(`${label} was not reconfigured: ${err?.message ?? err}`);
        }
        undo.push({
          label,
          runtimeId: runtime.id,
          back: () => api.configureService(scope, { uuid: svc.uuid }, svc.state as object),
        });
      }
    }
  } catch (err: any) {
    const results = await Promise.allSettled(undo.map(({ back }) => back()));
    const stuck = undo.filter((_, index) => results[index].status === "rejected");
    if (stuck.length) {
      throw new StuckRewrite(
        `${err?.message ?? err}; ${stuck.map(({ label }) => label).join(", ")} could not be put back and still ${stuck.length === 1 ? "names" : "name"} "${to}"`,
        stuck.map(({ runtimeId }) => runtimeId),
      );
    }
    throw err;
  }
  return undo.length;
}

/**
 * Moves the runtimes from an asset's old id to its new one: the descriptor
 * under the new id to every runtime naming the old one, then the references
 * rewritten. In that order, so that no service is told to use an id its
 * runtime has not been given — a runtime that does not take the descriptor
 * stops the rename before anything is rewritten. The old descriptor is left
 * for the caller to remove once this has succeeded. Returns how many services
 * were changed.
 *
 * A rename that fails takes the new descriptor back from every runtime that
 * was given it, so that none is left holding an asset the board never
 * declared — except a runtime with a service that could not be put back, which
 * still names it. The error says where it could not be taken back.
 */
export async function renameAssetOnRuntimes(
  board: AssetBoard,
  asset: AssetDescriptor,
  from: string,
): Promise<number> {
  const live = await liveServiceStates(board);
  const staged = ownRuntimes(board).filter(
    (runtime) =>
      takesPushes(board, runtime) &&
      findAssetRefs((live[runtime.id] ?? []).map((svc) => svc.state)).includes(from),
  );
  const refused = (
    await Promise.all(staged.map((runtime) => pushTo(board, runtime, { [asset.id]: asset })))
  ).filter((failure) => failure !== null);

  let failure: Error;
  let keptBy: string[] = [];
  if (refused.length) {
    failure = new Error(refused.map(({ problem }) => problem).join("; "));
  } else {
    try {
      return await rewriteAssetRefs(board, from, asset.id);
    } catch (err: any) {
      failure = err instanceof Error ? err : new Error(String(err));
      keptBy = err instanceof StuckRewrite ? err.runtimeIds : [];
    }
  }

  const given = staged.filter(
    (runtime) =>
      !refused.some((entry) => entry.runtime === runtime) && !keptBy.includes(runtime.id),
  );
  const left = (
    await Promise.all(given.map((runtime) => pushTo(board, runtime, { [asset.id]: null })))
  ).filter((entry) => entry !== null);
  if (left.length) {
    throw new Error(
      `${failure.message}; "${asset.id}" could not be taken back from ${left.map(({ runtime }) => runtime.name).join(", ")}`,
    );
  }
  throw failure;
}

/**
 * What each runtime referencing an asset says about resolving it — the view's
 * "fetch now". Asked of the runtimes that will use it, because only they can
 * say whether a URL or a file is within their reach.
 */
export async function checkAssetOnRuntimes(
  board: AssetBoard,
  assetId: string,
): Promise<Array<{ runtime: RuntimeDescriptor; check: AssetCheck }>> {
  const live = await liveServiceStates(board);
  const referencing = ownRuntimes(board).filter((runtime) =>
    findAssetRefs((live[runtime.id] ?? []).map((svc) => svc.state)).includes(assetId),
  );
  // Nothing references it yet: ask the first runtime that can answer, so an
  // asset can be checked before it is used.
  const asked = referencing.length
    ? referencing
    : ownRuntimes(board).filter((runtime) => apiOf(board, runtime)?.checkAsset).slice(0, 1);
  return Promise.all(
    asked.map(async (runtime) => {
      const scope = board.scopes[runtime.id];
      const api = apiOf(board, runtime);
      const check: AssetCheck =
        scope && api?.checkAsset
          ? await api.checkAsset(scope, assetId)
          : { ok: false, problem: `${runtime.name} cannot resolve assets` };
      return { runtime, check };
    }),
  );
}
