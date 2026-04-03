import {
  BoardDescriptor,
  isRuntimeGraphQLClassType,
  RestoreRuntimeResult,
  RuntimeDescriptor,
  toCanonicalRuntimeClassType,
} from "../types";
import { isUserAuthenticated } from "../runtime/remote/RemoteRuntimeApi";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";
import { BoardContextState } from "../BoardContext";

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

  const currentUser = refs.userRef.current;
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
      return api.restoreRuntime(
        { ...rt },
        boardServices[rt.id],
        currentUser,
        restoredBoardName,
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

  return {
    boardName: restoredBoardName,
    runtimes: validRuntimes,
    services: restoredServicesWithState,
    registry: newRegistry,
    scopes: newScopes,
  };
}

export async function fetchBoard(
  refs: BoardStateRefs,
  waitForUserLogin: () => Promise<void>,
  buildContextValue: () => BoardContextState,
) {
  const propsRef = refs.propsRef.current!;
  if (!propsRef.fetchBoard) {
    return;
  }

  refs.setIsFetching(true);
  try {
    const board = await propsRef.fetchBoard();
    const data = await restoreBoard(board, refs, waitForUserLogin);
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
          const config =
            api && scope ? await api.getServiceConfig(scope, svc) : {};
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
) {
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
  newBoardNameArg: string = "New Idea",
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
  refs.setBoardNameState(newBoardNameArg || "");
}
