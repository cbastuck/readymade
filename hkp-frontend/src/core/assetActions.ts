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
 * What each of the board's services is configured with now, asked of the
 * runtime hosting it. The board's copy of a service's state is what it was
 * loaded or last reported with, and a reference typed into a panel since is
 * exactly what *Used by* and a push must not miss.
 */
export async function liveServiceStates(
  board: AssetBoard,
): Promise<{ [runtimeId: string]: LiveService[] }> {
  const entries = await Promise.all(
    board.runtimes.map(async (runtime) => {
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

/** Every place the board's services name an asset, from what they hold now. */
export async function assetUses(board: AssetBoard, assetId?: string): Promise<AssetUse[]> {
  return findAssetUses(await liveServiceStates(board), assetId);
}

/**
 * Sends changed descriptors to the runtimes that need them: a new or edited
 * one to each runtime whose services reference it, a deletion (`null`) to
 * every runtime that takes pushes, since which of them were told about it is
 * not recorded anywhere and removing one it never had costs nothing.
 */
export async function pushAssetChanges(board: AssetBoard, changes: AssetPush): Promise<void> {
  if (!Object.keys(changes).length) {
    return;
  }
  const live = await liveServiceStates(board);
  await Promise.all(
    ownRuntimes(board).map(async (runtime) => {
      const scope = board.scopes[runtime.id];
      const api = apiOf(board, runtime);
      if (!scope || !api?.pushAssets) {
        return;
      }
      const referenced = findAssetRefs((live[runtime.id] ?? []).map((svc) => svc.state));
      const push: AssetPush = {};
      for (const [id, descriptor] of Object.entries(changes)) {
        if (descriptor === null || referenced.includes(id)) {
          push[id] = descriptor;
        }
      }
      if (Object.keys(push).length) {
        await api.pushAssets(scope, push);
      }
    }),
  );
}

/**
 * Rewrites every reference to `from` so it names `to`, by configuring each
 * service holding one with its state rewritten. The one edit to assets that
 * does reconfigure: what a service is configured with changes, not what the
 * reference resolves to. Returns how many services were changed.
 */
export async function rewriteAssetRefs(
  board: AssetBoard,
  from: string,
  to: string,
): Promise<number> {
  const live = await liveServiceStates(board);
  let changed = 0;
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
      await api.configureService(scope, { uuid: svc.uuid }, renamed);
      changed++;
    }
  }
  return changed;
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
  const referencing = board.runtimes.filter((runtime) =>
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
