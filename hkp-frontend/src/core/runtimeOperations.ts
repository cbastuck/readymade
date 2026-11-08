import {
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeConfiguration,
  isRuntimeRestClassType,
  withoutSession,
} from "../types";
import { reorderRuntime } from "../views/playground/BoardActions";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";
import { assetsById } from "../runtime/board/assets";
import {
  cleanAliases,
  remoteNameForBoard,
  resolveRuntimeAddress,
} from "../runtime/board/remote";

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
      const runtimeOnBoard: RuntimeDescriptor = {
        ...runtime,
        ...(remote ? { remote } : {}),
        state: { ...runtime.state, color: rtClass.color },
        boardName: currentBoardName,
      };
      // A runtime is given every asset it may use, and this one was created
      // before the board knew it to say which those are. It is handed the
      // source and sent them now, ahead of being put on the board: once it is
      // there a service can be added to it, and nothing later would send them
      // short of an edit or a reload.
      scope.assets = refs.assetsFor?.(runtimeOnBoard);
      const refused = await api.pushAssets?.(scope, assetsById(scope.assets?.()));
      if (refused) {
        // Not added without them: it would look like any other runtime and
        // resolve nothing, and loading this board would not bring it up at
        // all, since the assets then travel with the request that creates it.
        // Reported here rather than thrown, because what follows a throw asks
        // the person to log in again, and this is not about who they are.
        const removed = await api
          .removeRuntime(scope, runtimeOnBoard, currentUser)
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
      refs.setRuntimes((prev) => [...prev, runtimeOnBoard]);
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
      return runtimeOnBoard;
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
  // Applied JSON may be a runtime saved when descriptors still carried the
  // signed-in user; it does not come back onto the board with it.
  updated = { ...updated, runtime: withoutSession(updated.runtime) };
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

/** What a move left undone, for telling the person. */
export type MoveRuntimeOutcome = {
  /** Why the runtime could not be removed from the server it left; absent
   *  when it was. */
  leftBehind?: string;
};

const sameAddress = (a: string | undefined, b: string | undefined) =>
  (a ?? "").replace(/\/+$/, "") === (b ?? "").replace(/\/+$/, "");

/**
 * Moves a runtime to another runtime server: rebuilt there with the state its
 * services have now, then removed from where it was.
 *
 * What travels is what each service reports as its state, read live from the
 * server it is leaving — or, when that server no longer answers, the state the
 * board last had for it. What a server keeps for a board beside its services —
 * records, tables, files — is that server's and stays there: the runtime
 * starts on whatever the new server keeps under the same names.
 *
 * Built on the new server before it is taken off the old one, so a move that
 * fails throws having changed nothing. The id is kept, because the rest of the
 * board reaches the runtime by id (`hkp-mount://<runtimeId>/…`). The board
 * names the new server the way the runtime picker would (`remoteNameForBoard`),
 * and by its address when that name would not lead back to it.
 */
export async function moveRuntime(
  runtimeId: string,
  target: RuntimeClass,
  refs: BoardStateRefs,
): Promise<MoveRuntimeOutcome> {
  const runtime = refs.runtimesRef.current!.find((rt) => rt.id === runtimeId);
  if (!runtime) {
    throw new Error(`Runtime not found: ${runtimeId}`);
  }
  if (!isRuntimeRestClassType(runtime.type) || !isRuntimeRestClassType(target.type)) {
    throw new Error("Only a runtime on a runtime server can be moved to another one");
  }
  // A unit's runtime is the unit's to place, through its binding in the
  // composition; a move here would be written into the unit's own document.
  if (runtime.unit) {
    throw new Error(
      `"${runtime.name}" comes from the unit "${runtime.unit}" — place it through that unit's runtimes instead`,
    );
  }
  if (!target.url) {
    throw new Error(`"${target.name}" has no address`);
  }
  if (sameAddress(runtime.url, target.url)) {
    return {};
  }
  const [scope, api] = getRuntimeScopeApi(runtimeId, refs);
  if (!api || !scope) {
    throw new Error(`The runtime api is missing for ${runtime.type}`);
  }
  const user = refs.userRef.current;

  const carried = await Promise.all(
    (refs.servicesRef.current![runtimeId] ?? []).map(async (svc) => {
      let state = svc.state;
      try {
        state = await api.getServiceConfig(scope, svc);
      } catch {
        // The server it leaves did not answer: the board's last word on the
        // service is the most that can travel.
      }
      return {
        uuid: svc.uuid,
        serviceId: svc.serviceId,
        serviceName: svc.serviceName,
        state,
      };
    }),
  );

  const engines = refs.availableRuntimeEnginesRef.current ?? [];
  const name = remoteNameForBoard(engines, target.url);
  const resolved = name
    ? resolveRuntimeAddress({ id: runtimeId, remote: name }, engines)
    : undefined;
  const { remote: _remote, ...unaddressed } = withoutSession(runtime);
  const moved: RuntimeDescriptor = {
    ...unaddressed,
    url: target.url,
    ...(resolved?.ok && sameAddress(resolved.url, target.url) ? { remote: name } : {}),
  };

  const result = await api.restoreRuntime(
    moved,
    carried,
    user,
    refs.boardNameRef.current ?? undefined,
    refs.assetsFor?.(moved),
  );
  if (!result) {
    throw new Error(`"${target.name}" did not build the runtime`);
  }
  // A server already running a runtime under this id with the same services
  // is attached to rather than built, and keeps the state it has. What was
  // carried wins: that is what moving means.
  await Promise.all(
    carried
      .filter((svc) => {
        const running = result.services.find((s) => s.uuid === svc.uuid);
        return !!svc.state && !!running && !carriedStateHeld(svc.state, running.state);
      })
      .map((svc) => api.configureService(result.scope, svc, svc.state)),
  );

  let leftBehind: string | undefined;
  try {
    await api.removeRuntime(scope, runtime, user);
  } catch (err) {
    leftBehind = err instanceof Error ? err.message : String(err);
  }

  refs.setRuntimes((prev) =>
    prev.map((rt) => (rt.id === runtimeId ? moved : rt)),
  );
  refs.setServices((prev) => ({ ...prev, [runtimeId]: result.services }));
  refs.setRegistry((prev) => ({ ...prev, [runtimeId]: result.registry ?? [] }));
  refs.setScopes((prev) => ({ ...prev, [runtimeId]: result.scope }));
  return leftBehind ? { leftBehind } : {};
}

/** Whether a running service already holds every value that was carried to
 *  it. Only the carried keys count: a server adds its own (`__hkpMount`). */
function carriedStateHeld(carried: unknown, running: unknown): boolean {
  if (typeof carried !== "object" || carried === null) {
    return JSON.stringify(carried) === JSON.stringify(running);
  }
  if (typeof running !== "object" || running === null) {
    return false;
  }
  return Object.entries(carried).every(
    ([key, value]) =>
      JSON.stringify(value) === JSON.stringify((running as Record<string, unknown>)[key]),
  );
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
