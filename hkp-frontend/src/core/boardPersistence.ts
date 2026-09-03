import {
  BoardDescriptor,
  isRuntimeGraphQLClassType,
  RestoreRuntimeResult,
  RuntimeDescriptor,
  toCanonicalRuntimeClassType,
} from "../types";
import { isUserAuthenticated } from "../runtime/graphql/RuntimeGraphQLApi";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";
import { BoardContextState } from "../BoardContext";
import { redactSecrets, resolveSecrets } from "./secrets";
import { defaultUnitOrigin, linkBoard, reportUnitDiagnostics } from "./linkUnits";
import { BoardLinkage, unlinkProjection, UnitBoard } from "../runtime/board/units";
import { getLocalBoard } from "../views/playground/common";
import { toast } from "sonner";

function reduceByRuntimeId<T extends keyof RestoreRuntimeResult>(
  arr: Array<RestoreRuntimeResult | null>,
  prop: T,
): { [runtimeId: string]: RestoreRuntimeResult[T] } {
  return arr.reduce((all, cur) => {
    if (cur === null) {
      return all;
    }
    return cur ? { ...all, [cur.runtime.id]: cur[prop] } : all;
  }, {});
}

export async function restoreBoard(
  board: BoardDescriptor | undefined,
  refs: BoardStateRefs,
  waitForUserLogin: () => Promise<void>,
) {
  const {
    boardName: restoredBoardName = refs.boardNameRef.current ?? undefined,
    runtimes: boardRuntimes = [],
    services: boardServices = {},
  } = board || {};

  const propsRef = refs.propsRef.current!;

  const boardRequiresReauth = (
    await Promise.all(
      boardRuntimes.map((rtClass) =>
        isRuntimeGraphQLClassType(rtClass.type)
          ? isUserAuthenticated(rtClass, propsRef.user).catch((err) => {
              throw new Error(`${err.message} for runtime ${rtClass.url}`);
            })
          : Promise.resolve(true),
      ),
    )
  ).some((isAuthenticated) => !isAuthenticated);

  if (boardRequiresReauth && !refs.userRef.current) {
    await waitForUserLogin();
  }

  // Remote runtimes authenticate every call with the user's ID token. Restoring
  // that token is asynchronous, so on a cold page load it is not in context yet
  // and the board would provision with no credentials — which a runtime that
  // requires auth answers with 401. The reauth gate above does not cover this:
  // it only ever waits for GraphQL runtimes, and only for an interactive login.
  // Here the user may well be signed in already; we just have to let the
  // session settle first.
  const hasRemoteRuntime = boardRuntimes.some(
    (rtClass) => toCanonicalRuntimeClassType(rtClass.type) !== "browser",
  );
  const currentUser =
    refs.userRef.current ??
    (hasRemoteRuntime
      ? ((await refs.appContextRef?.current?.waitForAuthResolved()) ?? null)
      : null);

  const missingSecrets: string[] = [];
  const restored: Array<RestoreRuntimeResult | null> = await Promise.all(
    boardRuntimes.map((rt) => {
      const api =
        propsRef.runtimeApis?.[rt.type] ||
        propsRef.runtimeApis?.[toCanonicalRuntimeClassType(rt.type)];
      if (!api) {
        console.error(
          `BrowserContext.fetchBoard runtime api missing on restore runtime: ${JSON.stringify(
            rt,
          )} with type: ${rt.type} with registered apis: ${JSON.stringify(
            Object.keys(propsRef.runtimeApis || {}),
          )}`,
        );
        return Promise.resolve(null);
      }
      // Before any service is configured, and for every runtime alike: a
      // reference is a property of the board, not of the runtime that happens
      // to host the service holding it.
      const { value: services, missing } = resolveSecrets(
        boardServices[rt.id],
      );
      missingSecrets.push(...missing);
      // A runtime contributed by a unit keeps that unit's board name, which the
      // projection put there. It is not decoration: hkp-node derives a mount
      // address from the board name and keys an unnamed database file on it, so
      // letting the composition's name through here would rotate a unit's
      // public endpoints and move its data to a different file the moment it is
      // composed. See `runtime/board/units`.
      return api.restoreRuntime(
        { ...rt },
        services,
        currentUser,
        rt.boardName ?? restoredBoardName,
      );
    }),
  );

  const newScopes = reduceByRuntimeId(restored, "scope");
  const newRegistry = reduceByRuntimeId(restored, "registry");
  const restoredServicesWithState = reduceByRuntimeId(restored, "services");
  const validRuntimes = restored.flatMap((restoreResult) =>
    restoreResult && !!newScopes[restoreResult?.runtime.id]
      ? [restoreResult.runtime]
      : [],
  );

  reportMissingSecrets(missingSecrets);

  return {
    boardName: restoredBoardName,
    runtimes: validRuntimes,
    services: restoredServicesWithState,
    registry: newRegistry,
    scopes: newScopes,
  };
}

/**
 * Says which secrets a board asked for and did not get.
 *
 * By name, and once for the whole board: the services that needed them are
 * loaded but unconfigured, and will each fail later with their own wording
 * about a missing credential. This is the only message that says why.
 */
function reportMissingSecrets(missing: string[]): void {
  const aliases = [...new Set(missing)];
  if (!aliases.length) {
    return;
  }
  const named = aliases.join(", ");
  console.error(`Board references secrets that are not configured: ${named}`);
  toast.error(
    aliases.length === 1
      ? `Secret "${named}" is not configured`
      : `Secrets not configured: ${named}`,
    { description: "Services needing them will not be able to connect." },
  );
}

/**
 * A board as it will run: its units resolved and projected into it.
 *
 * Always applied, not only to compositions — a unit opened on its own is a
 * projection of one, and gets the same checks over what it declares. What it
 * does *not* get is an error for an import nothing satisfies: nobody promised
 * to satisfy it, which is what running alone means. See `core/linkUnits`.
 */
export async function linkBoardDocument(
  board: BoardDescriptor | undefined,
): Promise<{ board: BoardDescriptor | undefined; linkage?: BoardLinkage }> {
  if (!board) {
    return { board };
  }
  const projection = await linkBoard(
    board,
    defaultUnitOrigin((name) => getLocalBoard(name) ?? null),
  );
  reportUnitDiagnostics(projection.diagnostics);
  return {
    board: projection.board,
    // Nothing to remember about a board that is only itself.
    linkage: projection.units.length
      ? { units: projection.units, views: projection.views }
      : undefined,
  };
}

export async function fetchBoard(
  refs: BoardStateRefs,
  waitForUserLogin: () => Promise<void>,
  buildContextValue: () => BoardContextState,
  cancellation?: { cancelled: boolean },
) {
  const propsRef = refs.propsRef.current!;
  if (!propsRef.fetchBoard) {
    return;
  }

  refs.setIsFetching(true);
  try {
    const board = await propsRef.fetchBoard();
    // Units are resolved before anything is provisioned: what runs is the
    // projection, and a board that declares no units is its own projection.
    const { board: linked, linkage } = await linkBoardDocument(board);
    refs.setFacade(linked?.facade);
    refs.setLinkage(linkage);
    const data = await restoreBoard(linked, refs, waitForUserLogin);

    // In-flight cancellation (e.g. React strict-mode unmount/remount).
    // At this point runtimes are fully started so we must tear them down
    // ourselves — the unmount cleanup already ran with an empty runtime list.
    if (cancellation?.cancelled) {
      const user = refs.userRef.current;
      await Promise.all(
        (data?.runtimes ?? []).map(async (rt) => {
          const scope = data?.scopes?.[rt.id];
          const api =
            propsRef.runtimeApis?.[rt.type] ||
            propsRef.runtimeApis?.[toCanonicalRuntimeClassType(rt.type)];
          if (scope && api) {
            await api.removeRuntime(scope, rt, user);
          }
        }),
      );
      refs.setIsFetching(false);
      return;
    }

    if (data) {
      refs.setBoardNameState(data.boardName);
      refs.setRuntimes(data.runtimes);
      refs.setServices(data.services);
      refs.setRegistry(data.registry);
      refs.setScopes(data.scopes);
      refs.setIsFetching(false);
      setTimeout(() => {
        refs.propsRef.current!.onLoad?.({
          ...buildContextValue(),
          ...data,
          isFetching: false,
        });
      }, 1);
    }
  } catch (err: any) {
    refs.setErrorOnFetch(err);
    refs.setIsFetching(false);
    return;
  }
}

export async function serializeBoard(
  refs: BoardStateRefs,
): Promise<BoardDescriptor | null> {
  const runtimeStates: { [rtId: string]: any } = {};
  const currentRuntimes = refs.runtimesRef.current!;
  const currentServices = refs.servicesRef.current!;
  const serializedServices = await Object.keys(currentServices).reduce(
    async (all, runtimeId) => {
      const runtime = currentRuntimes.find((r) => r.id === runtimeId);
      if (!runtime) {
        throw new Error(
          `BoardContext.serializeBoard runtime with id: ${runtimeId} in: ${JSON.stringify(
            currentRuntimes,
          )}`,
        );
      }
      const [scope, api] = getRuntimeScopeApi(runtimeId, refs);
      const runtimeServices = currentServices[runtimeId];
      const serviceConfigs = await Promise.all(
        runtimeServices.map(async (svc) => {
          // A service reports what it was configured with. Where that was a
          // resolved secret, the board gets the reference back rather than
          // the value — see redactSecrets.
          const config = redactSecrets(
            api && scope ? await api.getServiceConfig(scope, svc) : {},
          );
          const runtimeState = {
            ...runtime.state,
            ...scope?.serializeState?.(),
          };
          runtimeStates[runtimeId] = runtimeState;
          return {
            uuid: svc.uuid,
            serviceId: svc.serviceId,
            serviceName: svc.serviceName,
            state: config,
          };
        }),
      );
      return {
        ...(await all),
        [runtimeId]: serviceConfigs,
      };
    },
    Promise.resolve({}),
  );

  const serializedRuntimes = currentRuntimes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    type: rt.type,
    url: rt.url,
    bundles: rt.bundles,
    // What a unit contributed keeps saying so, and keeps the board identity the
    // projection gave it. This is the serialisation deploying and sharing want:
    // the link *output*, the way a bundle is. Splitting it back into the
    // documents it came from is a different question, and belongs to saving.
    ...(rt.unit
      ? { unit: rt.unit, unitRuntimeId: rt.unitRuntimeId, boardName: rt.boardName }
      : {}),
    state: runtimeStates[rt.id] || {
      wrapServices: false,
      minimized: false,
    },
  }));

  const data = {
    runtimes: serializedRuntimes,
    services: serializedServices,
  };

  const propsRef = refs.propsRef.current!;
  return propsRef.serializeBoard ? propsRef.serializeBoard(data) : data;
}

export async function setBoardState(
  newState: BoardDescriptor,
  refs: BoardStateRefs,
  waitForUserLogin: () => Promise<void>,
  removeRuntime: (runtime: RuntimeDescriptor) => Promise<void>,
) {
  // Destroy all existing runtimes (and their services) before loading the new
  // board — otherwise long-lived resources like SSE streams, setInterval timers
  // and AudioContexts keep running in the background after the board switches.
  const currentRuntimes = refs.runtimesRef.current ?? [];
  for (const runtime of currentRuntimes) {
    await removeRuntime(runtime);
  }

  refs.setFacade(newState.facade);
  const data = await restoreBoard(newState, refs, waitForUserLogin);
  if (data) {
    refs.setBoardNameState(data.boardName);
    refs.setRuntimes(data.runtimes);
    refs.setServices(data.services);
    refs.setRegistry(data.registry);
    refs.setScopes(data.scopes);
    refs.propsRef.current!.onUpdateBoardState?.(data as BoardDescriptor);
  }
}

export async function clearBoard(
  newBoardNameArg: string = "Idea",
  refs: BoardStateRefs,
  removeRuntime: (runtime: RuntimeDescriptor) => Promise<void>,
) {
  const currentRuntimes = refs.runtimesRef.current!;
  const currentServices = refs.servicesRef.current!;
  const currentRegistry = refs.registryRef.current!;
  const currentBoardName = refs.boardNameRef.current ?? undefined;
  const propsRef = refs.propsRef.current!;
  const { onClearBoard } = propsRef;
  for (const runtime of currentRuntimes) {
    await removeRuntime(runtime);
  }

  if (onClearBoard) {
    await onClearBoard(
      {
        runtimes: currentRuntimes,
        services: currentServices,
        registry: currentRegistry,
        boardName: currentBoardName,
      },
      newBoardNameArg,
    );
  }

  refs.setRuntimes([]);
  refs.setServices({});
  refs.setRegistry({});
  refs.setFacade(undefined);
  refs.setBoardNameState(newBoardNameArg || "");
}

/**
 * The board as the documents it should be written back to.
 *
 * `serializeBoard` produces the link *output* — one flat board, which is what
 * deploying, sharing and exporting want, the way a bundle is. Saving wants the
 * opposite: the sources. A composition gets its own runtimes and the entries
 * that pulled the rest in; each unit gets its own document back, carrying only
 * what actually changed in it (see `unlinkProjection`).
 *
 * A board that was never assembled from units has one document, which is
 * itself — so callers need no special case for the ordinary board.
 */
export type BoardDocuments = {
  composition: UnitBoard;
  units: Array<{ name: string; uri: string; board: UnitBoard }>;
};

export async function serializeBoardDocuments(
  refs: BoardStateRefs,
  linkage: BoardLinkage | undefined,
): Promise<BoardDocuments | null> {
  const serialized = await serializeBoard(refs);
  if (!serialized) {
    return null;
  }
  if (!linkage?.units.length) {
    return { composition: serialized as UnitBoard, units: [] };
  }
  const { composition, units } = unlinkProjection(serialized, linkage.units);
  return {
    composition,
    units: units.map((entry) => ({
      name: entry.unit.name,
      uri: entry.unit.uri,
      board: entry.board,
    })),
  };
}
