import { RuntimeApi, RuntimeApiMap, RuntimeScope } from "hkp-frontend/src/types";

/**
 * Watching a runtime that is running on a remote server.
 *
 * Nobody here owns it. A runtime on a server was created by whoever created it
 * — a board in someone's playground, a coordinator, a config file — and the
 * server records no attribution, so this browser cannot tell who that is and
 * cannot become it. Everything that would change what the runtime *is* is
 * therefore refused: adding, removing or reordering services, and provisioning
 * a runtime at all. Configuring a service is allowed, since that is what the
 * runtime exists to be told, and a service's own state is the one thing it
 * answers for.
 *
 * The same reasoning as an attached cloud board (views/cloud/bridgeRuntimeApi),
 * one step further: there the coordinator owns the board and the browser is a
 * viewer; here there is no known owner to defer to at all — which is also why
 * forking is not offered. A board is forked where it is a document, not where
 * one of its runtimes happens to be running.
 */

function notObserving(what: string): never {
  throw new Error(
    `Cannot ${what} on a remote runtime — it belongs to whoever created it. Build the board in the playground instead.`,
  );
}

export function createObservedRuntimeApi(base: RuntimeApi): RuntimeApi {
  return {
    ...base,

    // Reading is the whole point, so these pass straight through.
    getHealth: base.getHealth,
    restoreRuntime: base.restoreRuntime,
    attachRuntimes: base.attachRuntimes,
    getServiceConfig: base.getServiceConfig,
    configureService: base.configureService,

    // Leaving the view drops this browser's connection and nothing else: the
    // runtime keeps running, as it did before anyone looked at it. Deleting it
    // would take down a board that is not ours.
    removeRuntime: async (scope: RuntimeScope) => {
      await scope.close?.();
    },

    addRuntime: async () => notObserving("provision a runtime"),
    addService: async () => notObserving("add a service"),
    removeService: async () => notObserving("remove a service"),
    rearrangeServices: async () => notObserving("reorder services"),
    // Running the pipeline pushes data through services that are wired into
    // someone else's board; what came out would go to its next runtime, not to
    // anything visible here.
    processRuntime: async () => notObserving("run a runtime"),
    processService: async () => notObserving("run a service"),
  };
}

/** The api map for an observed remote, built from the host's own apis. */
export function createObservedRuntimeApis(base: RuntimeApiMap): RuntimeApiMap {
  return Object.fromEntries(
    Object.entries(base).map(([type, api]) => [
      type,
      createObservedRuntimeApi(api),
    ]),
  );
}
