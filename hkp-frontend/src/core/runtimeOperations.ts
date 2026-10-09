import {
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeConfiguration,
  isRuntimeRestClassType,
} from "../types";
import { reorderRuntime } from "../views/playground/BoardActions";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";
import { assetsById } from "../runtime/board/assets";
import { cleanAliases, remoteNameForBoard } from "../runtime/board/remote";

export function registerBrowserRuntime(boardName: string, runtimeId: string) {
  const existing = JSON.parse(
    localStorage.getItem(`runtimes-${boardName}`) || "[]",
  );
  localStorage.setItem(
    `runtimes-${boardName}`,
    JSON.stringify(existing.concat(runtimeId)),
  );
}

export function unregisterBrowserRuntime(boardName: string, runtimeId: string) {
  const existing = JSON.parse(
    localStorage.getItem(`runtimes-${boardName}`) || "[]",
  );
  const pruned = existing.filter((id: string) => id !== runtimeId);
  localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(pruned));
}

export function isRuntimeInScopeDefault(
  runtime: RuntimeDescriptor,
  boardNameRef: BoardStateRefs["boardNameRef"],
): boolean {
  if (runtime.type !== "browser") {
    return true;
  }
  const board = boardNameRef.current;
  const ownedRuntimes = JSON.parse(
    localStorage.getItem(`runtimes-${board}`) || "[]",
  );
  return !!ownedRuntimes.find((runtimeId: string) => runtimeId === runtime.id);
}

/**
 * Puts a runtime on the board, and hands back the one it created.
 *
 * The descriptor is the caller's only way to name what it just made: the id is
 * minted in here (or by the runtime server), so a caller that wants to act on
 * the new runtime — the playground aims its selection at it — has nothing to
 * go on otherwise. Null means nothing was added, and the error was reported.
 */
export async function addRuntime(
  rtClass: RuntimeClass,
  refs: BoardStateRefs,
  waitForUserLogin: () => Promise<void>,
  onError?: (err: Error) => void,
): Promise<RuntimeDescriptor | null> {
  const propsRef = refs.propsRef.current!;
  const api = propsRef.runtimeApis?.[rtClass.type];
  if (!api) {
    throw new Error(
      `BoardContext.addRuntime() runtime api is missing: ${rtClass.type}`,
    );
  }
  const currentUser = refs.userRef.current;
  const currentBoardName = refs.boardNameRef.current ?? undefined;
  try {
    const result = await api.addRuntime(rtClass, currentUser, currentBoardName);
    if (result) {
      const {
        runtime,
        services: newServices,
        registry: newRegistry = [],
        scope,
      } = result;
      // A runtime put on a server this client keeps says which server by
      // name, as a board that is handed on has to: the address stays on the
      // live runtime beside it, and a save writes the name alone. One put on
      // an address this client keeps nothing under says the address.
      const remote = isRuntimeRestClassType(rtClass.type)
        ? remoteNameForBoard(
            refs.availableRuntimeEnginesRef?.current ?? [],
            rtClass.url,
          )
        : undefined;
      const runtimeWithUser: RuntimeDescriptor = {
        ...runtime,
        ...(remote ? { remote } : {}),
        user: currentUser,
        state: { ...runtime.state, color: rtClass.color },
        boardName: currentBoardName,
      };
      // A runtime is given every asset it may use, and this one was created
      // before the board knew it to say which those are. It is handed the
      // source and sent them now, ahead of being put on the board: once it is
      // there a service can be added to it, and nothing later would send them
      // short of an edit or a reload.
      scope.assets = refs.assetsFor?.(runtimeWithUser);
      const refused = await api.pushAssets?.(scope, assetsById(scope.assets?.()));
      if (refused) {
        // Not added without them: it would look like any other runtime and
        // resolve nothing, and loading this board would not bring it up at
        // all, since the assets then travel with the request that creates it.
        // Reported here rather than thrown, because what follows a throw asks
        // the person to log in again, and this is not about who they are.
        const removed = await api
          .removeRuntime(scope, runtimeWithUser, currentUser)
          .then(() => true)
          .catch(() => false);
        onError?.(
          new Error(
            `it did not take the board's assets (${refused}), so it was not added` +
              (removed ? "" : "; it could not be removed again and is still running there"),
          ),
        );
        return null;
      }
      refs.setRuntimes((prev) => [...prev, runtimeWithUser]);
      refs.setServices((prev) => ({
        ...prev,
        [runtime.id]: newServices,
      }));
      refs.setRegistry((prev) => ({
        ...prev,
        [runtime.id]: newRegistry,
      }));
      refs.setScopes((prev) => ({
        ...prev,
        [runtime.id]: scope,
      }));
      return runtimeWithUser;
    }
  } catch (err: any) {
    console.error("BoardContext.addRuntime", err, err.stack);
    onError?.(err);
    await waitForUserLogin();
  }
  return null;
}

export async function removeRuntime(
  runtime: RuntimeDescriptor,
  refs: BoardStateRefs,
): Promise<void> {
  const propsRef = refs.propsRef.current!;
  const { onRemoveRuntime } = propsRef;
  if (!onRemoveRuntime) {
    throw new Error("BoardContext misses prop: onRemoveRuntime");
  }
  await onRemoveRuntime(runtime);

  const [scope, api] = getRuntimeScopeApi(runtime.id, refs);
  if (!api || !scope) {
    throw new Error(
      `BoardContext.removeRuntime() runtime api is missing: ${runtime.type}`,
    );
  }

  await api.removeRuntime(scope, runtime, refs.userRef.current);

  refs.setRuntimes((prev) => prev.filter((r) => r.id !== runtime.id));
  refs.setServices((prev) =>
    Object.keys(prev)
      .filter((rid) => rid !== runtime.id)
      .reduce((all, key) => ({ ...all, [key]: prev[key] }), {}),
  );
  refs.setScopes((prev) =>
    Object.keys(prev)
      .filter((rid) => rid !== runtime.id)
      .reduce((all, key) => ({ ...all, [key]: prev[key] }), {}),
  );
  refs.setRegistry((prev) =>
    Object.keys(prev)
      .filter((rid) => rid !== runtime.id)
      .reduce((all, key) => ({ ...all, [key]: prev[key] }), {}),
  );
}

export async function updateRuntime(
  runtimeId: string,
  updated: RuntimeConfiguration,
  refs: BoardStateRefs,
): Promise<void> {
  const [scope, api] = getRuntimeScopeApi(runtimeId, refs);
  if (!api || !scope) {
    throw new Error(
      `BoardContext.updateRuntime() runtime api is missing: ${runtimeId}`,
    );
  }
  const runtime = refs.runtimesRef.current!.find((rt) => rt.id === runtimeId);
  if (!runtime) {
    throw new Error(
      `BoardContext.updateRuntime() runtime not found: ${runtimeId}`,
    );
  }
  if (runtimeId !== updated.runtime.id) {
    await api.removeRuntime(scope, runtime, refs.userRef.current);
    const result = await api.restoreRuntime(
      updated.runtime,
      updated.services,
      refs.userRef.current,
      undefined,
      refs.assetsFor?.(updated.runtime),
    );
    if (result) {
      refs.setRuntimes((prev) =>
        prev.map((rt) => (rt.id === runtimeId ? updated.runtime : rt)),
      );
      refs.setServices((prev) => ({
        ...prev,
        [updated.runtime.id]: updated.services,
      }));
      refs.setScopes((prev) => ({
        ...prev,
        [updated.runtime.id]: result.scope,
      }));
    }
  } else {
    await Promise.all(
      updated.services.map((svc) => api.configureService(scope, svc, svc)),
    );
    scope.setState?.(updated.runtime.state);
    refs.setRuntimes((prev) =>
      prev.map((rt) => (rt.id === runtimeId ? updated.runtime : rt)),
    );
  }
}

export async function arrangeRuntimes(
  runtimeId: string,
  targetPosition: number,
  refs: BoardStateRefs,
): Promise<void> {
  const [scope, api] = getRuntimeScopeApi(runtimeId, refs);
  if (!scope || !api) {
    throw new Error("BoardContext.arrangeServices, scope or api missing");
  }

  const currentRuntimes = refs.runtimesRef.current!;
  const rearranged = reorderRuntime(currentRuntimes, runtimeId, targetPosition);

  refs.setRuntimes(rearranged);
}

/** A remote as the pool keeps it: its aliases only when it has any. */
function poolEntry({ name, url, type, color, aliases }: RuntimeClass): RuntimeClass {
  const kept = cleanAliases(name, aliases);
  return { name, type, url, color, ...(kept.length ? { aliases: kept } : {}) };
}

export function addAvailableRuntime(
  runtime: RuntimeClass,
  overwriteIfExists: boolean,
  refs: BoardStateRefs,
): Array<RuntimeClass> {
  const { name } = runtime;
  const current = refs.availableRuntimeEnginesRef.current!;
  const engines = overwriteIfExists
    ? current.filter((rt) => rt.name !== name)
    : current;
  const updated = engines.concat(poolEntry(runtime));
  refs.setAvailableRuntimeEngines(updated);
  return updated;
}

/** Replaces `previous` with `next`, keeping its place in the pool. The pool
 *  is keyed by name, so the entry is matched on the name it had — a rename
 *  through add-then-remove would either leave the old entry behind or undo
 *  itself, both writes being computed from the same pool. */
export function updateAvailableRuntime(
  previous: RuntimeClass,
  next: RuntimeClass,
  refs: BoardStateRefs,
): Array<RuntimeClass> {
  const { name } = next;
  const current = refs.availableRuntimeEnginesRef.current!;
  const entry = poolEntry(next);
  const replaced = current.some((rt) => rt.name === previous.name)
    ? current.map((rt) => (rt.name === previous.name ? entry : rt))
    : current.concat(entry);
  // Renaming onto a name the pool already holds collapses the two: it is keyed
  // by name and cannot keep both.
  const updated = replaced.filter((rt) => rt === entry || rt.name !== name);
  refs.setAvailableRuntimeEngines(updated);
  return updated;
}

export function removeAvailableRuntime(
  { name }: RuntimeClass,
  refs: BoardStateRefs,
): Array<RuntimeClass> {
  const updated = refs.availableRuntimeEnginesRef.current!.filter(
    (rt) => rt.name !== name,
  );
  refs.setAvailableRuntimeEngines(updated);
  return updated;
}

export async function setRuntimeName(
  runtimeId: string,
  newName: string,
  refs: BoardStateRefs,
): Promise<void> {
  refs.setRuntimes((prev) =>
    prev.map((rt) => {
      if (rt.id === runtimeId && rt.type !== "browser") {
        throw new Error(
          "BoardContext.setRuntimeName() only supported for browser runtimes",
        );
      }
      return rt.id === runtimeId ? { ...rt, name: newName } : rt;
    }),
  );
}
