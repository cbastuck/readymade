import { v4 as uuidv4 } from "uuid";
import { referencedSecrets, secretStore } from "hkp-frontend/src/core/secrets";
import {
  SecretRelease,
  allowedSecrets,
} from "hkp-frontend/src/core/secretConsent";
import { requestFromServer } from "hkp-frontend/src/core/runtimeReach";

import {
  InstanceId,
  ProcessContext,
  RestoreRuntimeResult,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceClass,
  ServiceDescriptor,
  User,
} from "hkp-frontend/src/types";
import RuntimeRestScope from "./RuntimeRestScope";
import {
  AssetPush,
  AssetsSource,
  assetsById,
} from "hkp-frontend/src/runtime/board/assets";
import { isBinaryData } from "./Data";
import { EngineState } from "hkp-frontend/src/BoardContext";
import { startedRun } from "../processContext";

// A runtime reports its notification WebSocket URL using its own externalIP,
// which is 127.0.0.1 for an embedded runtime (correct only for a client on the
// same host — e.g. the simulator). For a remote runtime we must connect to the
// same host we reached the runtime at, so rewrite the ws URL's host to the
// runtime's URL host while preserving the server-assigned ws port and path.
function resolveOutputUrl(
  outputUrl: string,
  runtimeUrl: string | undefined,
): string {
  if (!outputUrl || !runtimeUrl) {
    return outputUrl;
  }
  try {
    const out = new URL(outputUrl);
    const base = new URL(runtimeUrl);
    // The embedded local runtime is addressed through the custom `hkp://remotes/`
    // proxy scheme, whose authority ("remotes") is a routing label, not a real
    // network host — copying it would yield ws://remotes:port and fail DNS. The
    // runtime is always co-located with its webview here, so target loopback.
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      out.hostname = "127.0.0.1";
    } else {
      out.hostname = base.hostname;
    }
    return out.toString();
  } catch {
    return outputUrl;
  }
}

function authHeaders(user: User | null): Record<string, string> {
  if (!user?.idToken) {
    return {};
  }
  return { Authorization: `Bearer ${user.idToken}` };
}

/**
 * A 401 has two very different causes, and the distinction is the whole
 * diagnosis: either we sent no credentials at all (not signed in, or the
 * session had not been restored yet when the board loaded), or we sent a token
 * the runtime rejected (wrong audience, expired, not on the email allowlist).
 * The bare status cannot be told apart by whoever reads the error, so say which.
 */
function describeAuthFailure(
  res: Response,
  user: User | null,
  url: string,
): string | null {
  if (res.status !== 401 && res.status !== 403) {
    return null;
  }
  return user?.idToken
    ? `${res.status} ${res.statusText}: the runtime rejected this account's token — ` +
        `check AUTH0_AUDIENCE matches the app's client id and that ALLOWED_EMAILS permits it (${url})`
    : `${res.status} ${res.statusText}: no credentials were sent — sign in on this site, ` +
        `then reload the board (${url})`;
}

/** The runtime server's own name for what it is, when it reports one. */
function serverKindOf(body: unknown): string | undefined {
  const server = (body as { server?: unknown } | null)?.server;
  return typeof server === "string" && server ? server : undefined;
}

/** What a runtime server says about itself, or why it could not be asked. */
export type RuntimeServerReport =
  | {
      status: "ok";
      /** "node", "python", "c++" — as the server names itself. */
      kind?: string;
      /** Absent when the server reports none; then nothing can be checked. */
      registry?: ServiceClass[];
      /** Whether it can connect to a coordinator when introduced to one. */
      coordinatorLinks: boolean;
      /**
       * Whether it keeps a deployed board's runtimes apart from the ones a
       * client creates. One that does not shares them under the board's ids,
       * and this client deleting its own would delete the deployed board's.
       */
      boardRuntimes: boolean;
    }
  | { status: "refused"; detail: string }
  | { status: "unreachable"; detail?: string };

/**
 * Asks a runtime server what it is, as this person.
 *
 * `GET /runtimes` already says it all — the kind, the registry and what the
 * server can do are properties of the build, reported beside the caller's own
 * runtimes — so there is no separate route to ask, and no second auth path.
 */
export async function describeRuntimeServer(
  url: string,
  user: { idToken?: string } | null,
): Promise<RuntimeServerReport> {
  let res: Response;
  try {
    res = await fetch(`${url}/runtimes`, {
      headers: user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {},
    });
  } catch (err) {
    return {
      status: "unreachable",
      detail: err instanceof Error ? err.message : undefined,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return { status: "refused", detail: `${res.status}` };
  }
  if (!res.ok) {
    return { status: "unreachable", detail: `${res.status}` };
  }
  const body = (await res.json().catch(() => null)) as {
    registry?: ServiceClass[];
    coordinatorLinks?: unknown;
    boardRuntimes?: unknown;
  } | null;
  return {
    status: "ok",
    kind: serverKindOf(body),
    registry: Array.isArray(body?.registry) ? body.registry : undefined,
    coordinatorLinks: body?.coordinatorLinks === true,
    boardRuntimes: body?.boardRuntimes === true,
  };
}

/**
 * Introduces a runtime server to a coordinator, for one runtime of one board.
 *
 * The coordinator dials nothing, so somebody has to tell the runtime server
 * where to connect — and this client is the one party with a session on both
 * sides. It passes on the ticket the coordinator issued; the runtime server
 * connects with it and keeps it to reconnect with.
 *
 * `secrets` are the values for the references that runtime's services carry.
 * They go to the runtime server this person chose, from this person's vault,
 * and not to the coordinator.
 */
export async function introduceRuntimeServer(
  url: string,
  user: { idToken?: string } | null,
  introduction: {
    coordinatorUrl: string;
    ticket: string;
    boardName: string;
    runtimeId: string;
    secrets?: Record<string, { value: string; audience?: string[] }>;
  },
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${url}/coordinator-links`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}),
      },
      body: JSON.stringify(introduction),
    });
  } catch (err) {
    throw new Error(
      `its runtime server could not be reached (${err instanceof Error ? err.message : "no answer"})`,
    );
  }
  if (res.ok) {
    return;
  }
  if (res.status === 404 || res.status === 405) {
    throw new Error("its runtime server cannot connect to a coordinator");
  }
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(
    body?.error
      ? `its runtime server could not connect to the coordinator — ${body.error}`
      : `its runtime server refused (${res.status})`,
  );
}

function normalizeRegistry(registry: ServiceClass[]): ServiceClass[] {
  return registry.map((entry) => {
    if (entry.serviceId !== "sub-service") {
      return entry;
    }

    const capabilities = entry.capabilities ?? [];
    const hasSubservices = capabilities.some(
      (cap) => cap.trim().toLocaleLowerCase() === "subservices",
    );

    return hasSubservices
      ? entry
      : { ...entry, capabilities: [...capabilities, "subservices"] };
  });
}

async function createScope(
  runtime: RuntimeDescriptor,
  runtimeOutputUrl: string,
  user: User | null,
): Promise<RuntimeRestScope> {
  return new RuntimeRestScope(runtime, runtimeOutputUrl, user);
}

export async function addRuntime(
  rtClass: RuntimeClass,
  user: User | null,
  boardName = "",
) {
  const { name: passedName, type, url } = rtClass;
  const runtimeId = uuidv4();
  const runtime = {
    id: runtimeId,
    name: passedName || "Browser Runtime",
    type,
    url,
  };

  const { scope, registry } = await createRuntimeRequest(
    runtime,
    [],
    boardName,
    user,
  );
  return {
    runtime,
    services: [],
    scope,
    registry,
  };
}

export async function removeRuntime(
  scope_: RuntimeScope,
  runtime: RuntimeDescriptor,
  _user: User | null,
): Promise<void> {
  const scope = scope_ as RuntimeRestScope;
  scope.close();

  const res = await fetch(`${runtime.url}/runtimes/${runtime.id}`, {
    method: "DELETE",
    headers: { ...authHeaders(scope.authenticatedUser) },
  });
  if (!res.ok) {
    throw new Error("Failed to remove runtime" + res.statusText);
  }
}

/**
 * Whether a runtime already running under this id is the one this board wants.
 *
 * Compared by service identity only — uuid and serviceId, in order — never by
 * state: a running service's state legitimately drifts (a timer's count, a
 * server's assigned address), and treating that as a difference would rebuild
 * the runtime on every reload, which is the opposite of the point.
 */
function isSameRuntime(
  running: Array<ServiceDescriptor> | undefined,
  wanted: Array<{ uuid: string; serviceId: string }>,
): boolean {
  const current = running ?? [];
  if (current.length !== wanted.length) {
    return false;
  }
  return wanted.every(
    (svc, index) =>
      current[index]?.uuid === svc.uuid &&
      current[index]?.serviceId === svc.serviceId,
  );
}

/**
 * Attaches to a runtime that is already running under this board's id, or
 * returns null so the caller provisions one.
 *
 * Asking first is what tells the two intents apart. Reloading a page, or opening
 * a board someone else is running, means "attach": the services keep running and
 * whatever addresses they published stay valid. Posting the board means
 * "provision": create it, replacing anything under that id. Only the client
 * knows which it meant, so it says so by asking before it posts — rather than
 * posting always and leaving each runtime to guess (which they do differently:
 * hkp-node reuses, hkp-python and hkp-rt rebuild).
 *
 * A runtime whose services no longer match the board is not the board's runtime,
 * so it is left to be replaced.
 */
/**
 * The values a runtime needs, by alias, for the references its services carry.
 *
 * Only what this runtime's own services ask for. A board with one webhook must
 * not put every credential the vault holds into a server it happens to use:
 * what a runtime is given is what it could leak, so it is given the minimum
 * that lets it run.
 *
 * Absent aliases are simply not sent. The service referencing one reports it
 * as unavailable by name, which is a better failure than a runtime holding a
 * credential nobody could account for.
 */
export async function secretsFor(
  services: Array<{ state?: unknown }> | undefined,
  release: Omit<SecretRelease, "aliases">,
): Promise<Record<string, { value: string; audience?: string[] }>> {
  const store = secretStore();
  // Only aliases with something behind them are put to the person: being asked
  // to approve a secret that does not exist is a question with no answer, and
  // the service naming it reports it as unavailable either way.
  const held = referencedSecrets(services ?? []).filter(
    (alias) => store.get(alias) !== null,
  );
  const allowed = await allowedSecrets({ ...release, aliases: held });

  const payload: Record<string, { value: string; audience?: string[] }> = {};
  for (const alias of allowed) {
    const value = store.get(alias);
    if (value === null) {
      continue;
    }
    const audience = store.audience?.(alias) ?? null;
    payload[alias] = audience?.length ? { value, audience } : { value };
  }
  return payload;
}

/**
 * Hands a running runtime the values for the references it holds.
 *
 * Provisioning carries these already; this covers the moments it cannot — a
 * board being built a service at a time, a vault entry edited while a board
 * runs, and attaching to a runtime that restarted, where the services survived
 * and the values did not. Sending nothing is not an error: a board with no
 * references has nothing to push.
 */
export async function pushSecrets(
  runtime: RuntimeDescriptor,
  services: Array<{ state?: unknown }> | undefined,
  user: User | null,
  boardName = "",
): Promise<void> {
  const secrets = await secretsFor(services, {
    boardName,
    runtimeId: runtime.id,
    runtimeName: runtime.name,
    url: runtime.url ?? "",
  });
  if (!Object.keys(secrets).length) {
    return;
  }
  try {
    await fetch(`${runtime.url}/runtimes/${runtime.id}/secrets`, {
      method: "POST",
      body: JSON.stringify(secrets),
      headers: { "content-type": "application/json", ...authHeaders(user) },
    });
  } catch {
    // A runtime that cannot be reached is reported by everything else the
    // caller is doing; a failed push costs the credentials, and the services
    // needing them say so themselves.
  }
}

/**
 * Hands a running runtime asset descriptors: new, changed, or `null` for one
 * the board deleted.
 *
 * A runtime is created with all the assets it is given, so there are two
 * moments left: re-attaching to a runtime that restarted, which lost its
 * store, and an asset edited while the board runs. That push is what makes an
 * edit take effect, since the services holding the reference resolve it on
 * their next use and are not reconfigured.
 *
 * Answers why the runtime did not take them, or null when it did. Never
 * throws: where a runtime is being attached to, a failure here is reported by
 * everything else the caller is doing, and the services needing an asset say
 * so themselves. An edit has nothing else to report it — the runtime goes on
 * using the descriptor it has — so that caller reads the answer.
 */
export async function pushAssetsTo(
  runtime: RuntimeDescriptor,
  assets: AssetPush,
  user: User | null,
): Promise<string | null> {
  if (!Object.keys(assets).length) {
    return null;
  }
  try {
    const res = await fetch(`${runtime.url}/runtimes/${runtime.id}/assets`, {
      method: "POST",
      body: JSON.stringify(assets),
      headers: { "content-type": "application/json", ...authHeaders(user) },
    });
    if (!res.ok) {
      console.warn(
        `Pushing assets to ${runtime.id} failed (${res.status}); services referencing ${Object.keys(assets).join(", ")} will report them as unknown`,
      );
      return `${runtime.name} answered ${res.status}`;
    }
    return null;
  } catch (err: any) {
    return `${runtime.name} is unreachable: ${err?.message ?? err}`;
  }
}

async function pushAssets(scope: RuntimeScope, assets: AssetPush): Promise<string | null> {
  const restScope = scope as RuntimeRestScope;
  return pushAssetsTo(restScope.descriptor, assets, restScope.authenticatedUser);
}

async function attachRuntime(
  runtime: RuntimeDescriptor,
  // State included: attaching re-pushes the values for the references it
  // carries, which cannot be read off a uuid alone.
  services: Array<{ uuid: string; serviceId: string; state?: unknown }>,
  user: User | null,
  boardName = "",
  assets?: AssetsSource,
): Promise<RestoreRuntimeResult | null> {
  let res: Response;
  try {
    res = await fetch(`${runtime.url}/runtimes`, {
      headers: { ...authHeaders(user) },
    });
  } catch {
    // Unreachable, or not a runtime server. Let provisioning report it: its
    // error messages already tell auth failures apart from the rest.
    return null;
  }
  if (!res.ok) {
    return null;
  }

  const body = await res.json();
  const runtimes: RestRuntimeData[] = Array.isArray(body)
    ? body
    : (body.runtimes ?? []);
  const existing = runtimes.find((rt) => rt.id === runtime.id);
  if (!existing || !isSameRuntime(existing.services, services)) {
    return null;
  }

  const registry = normalizeRegistry(
    Array.isArray(body) ? [] : (body.registry ?? []),
  );
  const descriptor: RuntimeDescriptor = { ...runtime, ...existing };
  const scope = new RuntimeRestScope(
    descriptor,
    resolveOutputUrl(existing.outputUrl, runtime.url),
    user,
  );
  scope.registry = registry;
  scope.server = serverKindOf(body);
  scope.services = existing.services;
  scope.boardName = boardName;
  // A runtime that restarted still has its services and no longer has their
  // credentials, and nothing here can tell that apart from one that never
  // stopped. Pushing again is idempotent, so it is done either way.
  await pushSecrets(descriptor, services, user, boardName);
  // Likewise the asset store, which lives in memory beside the vault.
  scope.assets = assets;
  await pushAssetsTo(descriptor, assetsById(assets?.()), user);
  return {
    runtime: descriptor,
    // The running services, not the board's: their state is what is live.
    services: existing.services,
    scope,
    registry,
  };
}

async function restoreRuntime(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  user: User | null,
  boardName?: string,
  assets?: AssetsSource,
): Promise<RestoreRuntimeResult | null> {
  const svcs = (services ?? []).map((s) => ({
    uuid: s.uuid || uuidv4(),
    serviceName: s.serviceName,
    serviceId: s.serviceId,
    state: (s as any).state, // TODO:
  }));

  const attached = await attachRuntime(runtime, svcs, user, boardName, assets);
  if (attached) {
    return attached;
  }

  const {
    registry,
    scope,
    services: createdServices,
  } = await createRuntimeRequest(runtime, svcs, boardName, user, assets);
  return {
    runtime,
    services: createdServices,
    scope,
    registry,
  };
}

type RestRuntimeData = {
  id: string;
  name: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    version?: string;
    capabilities?: string[];
    state: any;
    uuid: string;
  }>;
  outputUrl: string;
};

export async function attachRuntimes(
  rtClass: RuntimeClass,
  user: User | null,
): Promise<EngineState> {
  const initState: EngineState = {
    runtimes: [],
    services: {},
    scopes: {},
    registry: {},
  };
  if (!rtClass) {
    return initState;
  }
  const url = `${rtClass.url}/runtimes`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { ...authHeaders(user) } });
  } catch (err: any) {
    throw new Error(`${err?.message ?? "Load failed"}: ${url}`);
  }
  if (!res.ok) {
    const authFailure = describeAuthFailure(res, user, url);
    throw new Error(
      authFailure
        ? `Failed to fetch runtimes — ${authFailure}`
        : `Failed to fetch runtimes (${res.status} ${res.statusText}): ${url}`,
    );
  }
  const body = await res.json();
  const runtimes: RestRuntimeData[] = Array.isArray(body)
    ? body
    : (body.runtimes ?? []);
  const registry = normalizeRegistry(
    Array.isArray(body) ? [] : (body.registry ?? []),
  );

  // TODO: get rid of the any type
  return runtimes.reduce((acc: any, cur: RestRuntimeData) => {
    const rt: RuntimeDescriptor = { ...rtClass, ...cur };
    const scope = new RuntimeRestScope(
      rt,
      resolveOutputUrl(cur.outputUrl, rtClass.url),
      user,
    );
    scope.registry = registry;
    scope.server = serverKindOf(body);
    scope.services = cur.services;
    return {
      ...acc,
      runtimes: [...acc.runtimes, rt],
      services: { ...acc.services, [cur.id]: cur.services },
      registry: { ...acc.registry, [cur.id]: registry },
      scopes: { ...acc.scopes, [cur.id]: scope },
    };
  }, initState);
}

export async function processRuntime(
  scope_: RuntimeScope,
  params: any,
  _svc: InstanceId | null,
  context?: ProcessContext | null,
): Promise<void> {
  const scope = scope_ as RuntimeRestScope;
  const runtime = scope.descriptor;

  // No input is `null` on the wire, whichever transport carries it. JSON has
  // no undefined: over the socket the key would be dropped from the frame and
  // over REST the body would be empty, and a runtime reads both as "no payload
  // was sent" — a malformed call — rather than as "run with nothing on the
  // input", which is what a plain Run means and what a service like
  // `http-client` answers with its own configured body.
  const payload = params ?? null;

  if (
    !scope.sendMessageViaWebsocket(
      payload,
      startedRun(context),
      "processRuntime",
    )
  ) {
    // if sending failed, we probably don't have a runtimeOutput, we send a REST request
    if (isBinaryData(payload)) {
      // A JSON body cannot carry bytes, and a body the runtime misreads is
      // worse than none: this pass is dropped until the socket is open.
      // Logged as a running total at most once a second, since a stream
      // arrives many times that often.
      scope.droppedBytes += payload.byteLength;
      const now = Date.now();
      if (now - scope.droppedLoggedAt >= 1000) {
        console.warn(
          `processRuntime: ${runtime.id} has no open socket; dropped ${scope.droppedBytes} bytes`,
        );
        scope.droppedBytes = 0;
        scope.droppedLoggedAt = now;
      }
      return;
    }
    const res = await fetch(`${runtime.url}/runtimes/${runtime.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(scope.authenticatedUser),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to process ${runtime.id} runtime: ${res.statusText}`,
      );
    }
  }
}

export async function addService(
  scope: RuntimeScope,
  service: ServiceClass,
  /**
   * The uuid to create the service under, when the caller has one to keep — a
   * preset recreating an instance in place, a service moved from another
   * runtime. Facade widgets reference a service by uuid and a mount address is
   * derived from one, so a caller that holds one is saying those must survive.
   * Without it the runtime names the instance, as adding a new service does.
   */
  instanceId?: string,
) {
  const runtime = scope.descriptor;
  const restScope = scope as RuntimeRestScope;
  const scopeRegistry = restScope.registry || [];
  const descriptor =
    scopeRegistry.find((entry) => entry.serviceId === service.serviceId) ||
    service;
  const payload = {
    ...descriptor,
    // The registry entry supplies the contract; the caller supplies the name,
    // when it has one to ask for — a preset naming the instance it configures.
    // Without this the runtime stores its registry's name and answers with it.
    serviceName: service.serviceName || descriptor.serviceName,
    uuid: instanceId || uuidv4(),
  };
  const res = await fetch(`${runtime.url}/runtimes/${runtime.id}/services`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      ...authHeaders(restScope.authenticatedUser),
    },
  });
  if (!res.ok) {
    throw new Error("Failed to add service: " + res.statusText);
  }

  const config = await res.json();
  const createdService = {
    ...descriptor,
    serviceName: payload.serviceName,
    state: config,
    uuid: payload.uuid,
  };
  return createdService;
}

export async function removeService(
  scope: RuntimeScope,
  service: InstanceId,
): Promise<Array<ServiceDescriptor> | null> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
    {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        ...authHeaders((scope as RuntimeRestScope).authenticatedUser),
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to remove service from runtime" + res.statusText);
  }
  const data = await res.json();
  return data.services;
}

export async function configureService(
  scope: RuntimeScope,
  service: InstanceId,
  config: object,
): Promise<object> {
  const runtime = scope.descriptor;
  // A configuration may name a secret the runtime has not been given: a runtime
  // is created before it has services, and a field naming one can be filled in
  // at any time after that. Sent before the configuration rather than after,
  // because configuring a service is what can put it to use. Only what this
  // configuration names — anything else a service holds arrived with the
  // configuration that named it.
  await pushSecrets(
    runtime,
    [{ state: config }],
    (scope as RuntimeRestScope).authenticatedUser,
    (scope as RuntimeRestScope).boardName,
  );
  // Not so for assets: a runtime is given every asset it may use when it is
  // created, and again whenever one changes, so whichever a configuration
  // names is already there.
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
    {
      method: "POST",
      body: JSON.stringify(config),
      headers: {
        "content-type": "application/json",
        ...authHeaders((scope as RuntimeRestScope).authenticatedUser),
      },
    },
  );
  if (!res.ok) {
    throw new Error("Failed to configure service" + res.statusText);
  }

  const data = await res.json();
  scope.onConfig?.(service.uuid, { state: data }); // TODO: this only works for full state due to see RuntimeRestScope scope.onConfig = ...
  (scope as RuntimeRestScope).emitReport?.(service.uuid, data);

  return data;
}

export async function getServiceConfig(
  scope: RuntimeScope,
  service: InstanceId,
): Promise<any> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
    { headers: { ...authHeaders((scope as RuntimeRestScope).authenticatedUser) } },
  );
  if (!res.ok) {
    throw new Error("Failed to get service configure: " + res.statusText);
  }

  const state = await res.json();
  return state;
}

/**
 * Runs the pipeline from `service` onward, that service included.
 *
 * The runtime-wide entry point (`processRuntime`) always starts at the first
 * service, which is the wrong thing for anything that means "carry on from
 * here" — replaying a captured value from the flow inspector, a panel pushing
 * its buffer downstream. Both need the services before the target left alone.
 */
export async function processService(
  scope: RuntimeScope,
  service: InstanceId,
  params: any,
  _context?: ProcessContext | null,
): Promise<any> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}/process`,
    {
      method: "POST",
      body: JSON.stringify(params ?? null),
      headers: {
        "content-type": "application/json",
        ...authHeaders((scope as RuntimeRestScope).authenticatedUser),
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to process service ${service.uuid}: ${res.status} ${res.statusText}`,
    );
  }

  // A pipeline that stopped answers with an empty body rather than JSON.
  const body = await res.text();
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function rearrangeServices(
  scope: RuntimeScope,
  newOrder: Array<ServiceDescriptor>,
): Promise<Array<ServiceDescriptor>> {
  const runtime = scope.descriptor;
  const res = await fetch(`${runtime.url}/runtimes/${runtime.id}/rearrange`, {
    method: "POST",
    body: JSON.stringify(newOrder.map((s) => s.uuid)),
    headers: {
      "content-type": "application/json",
      ...authHeaders((scope as RuntimeRestScope).authenticatedUser),
    },
  });
  if (!res.ok) {
    throw new Error("Failed to rearrange services" + res.statusText);
  }

  const state = await res.json();
  return state.services;
}

async function createRuntimeRequest(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  boardName?: string,
  user?: User | null,
  assets?: AssetsSource,
) {
  const payload = {
    name: runtime.name,
    id: runtime.id,
    // This browser is the board's controller, so its runtimes should not
    // outlive it: when the last client disconnects — the tab closes, or the
    // page is reloaded — the runtime server frees them. A board that should
    // keep running without a browser is one to deploy to a coordinator, which
    // provisions its runtimes without asking for cleanup.
    garbageCollected: true,
    services: services.map((s) => ({
      uuid: s.uuid || uuidv4(),
      serviceId: s.serviceId,
      state: (s as any).state, // TODO:
    })),
    boardName: boardName || undefined,
    // Values ride with the create payload because provisioning is one call:
    // the services in it are configured before it returns, and a service that
    // connects while being configured needs its credential by then.
    secrets: await secretsFor(services, {
      boardName: boardName ?? "",
      runtimeId: runtime.id,
      runtimeName: runtime.name,
      url: runtime.url ?? "",
    }),
    // With the create payload for the same reason: a service that loads its
    // content while being configured needs the descriptor by then. Every
    // asset this runtime is given, whether or not a service names it yet.
    assets: assetsById(assets?.()),
  };
  const runtimesUrl = `${runtime.url}/runtimes`;
  let res: Response;
  try {
    // A server that gives no answer is either not running or does not allow
    // this page, and somebody can fix both while this waits; see runtimeReach.
    res = await requestFromServer(
      { url: runtime.url ?? "", runtimeName: runtime.name },
      () =>
        fetch(runtimesUrl, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: {
            "content-type": "application/json",
            ...authHeaders(user ?? null),
          },
        }),
    );
  } catch (err: any) {
    throw new Error(`${err?.message ?? "Load failed"}: ${runtimesUrl}`);
  }
  if (!res.ok) {
    const authFailure = describeAuthFailure(res, user ?? null, runtimesUrl);
    throw new Error(
      authFailure
        ? `Failed to create runtime — ${authFailure}`
        : `Failed to create runtime (${res.status} ${res.statusText}): ${runtimesUrl}`,
    );
  }
  const body = await res.json();
  const { registry, runtimes } = body;
  const normalizedRegistry = normalizeRegistry(registry ?? []);
  const rt = runtimes[0]; // TODO only considering the first runtime here
  if (!rt) {
    throw new Error("Failed to create runtime - no runtime was addeed");
  }
  const scope = await createScope(
    runtime,
    resolveOutputUrl(rt.outputUrl, runtime.url),
    user ?? null,
  );
  scope.registry = normalizedRegistry;
  scope.server = serverKindOf(body);
  scope.services = rt.services ?? [];
  scope.boardName = boardName ?? "";
  scope.assets = assets;

  return {
    runtime: rt,
    services: rt.services,
    scope,
    registry: normalizedRegistry,
  };
}

const api: RuntimeApi = {
  resolvesAddress: true,
  addRuntime,
  removeRuntime,
  restoreRuntime,
  attachRuntimes,
  processRuntime,
  addService,
  removeService,
  configureService,
  getServiceConfig,
  processService,
  rearrangeServices,
  pushAssets,
};

export default api;
