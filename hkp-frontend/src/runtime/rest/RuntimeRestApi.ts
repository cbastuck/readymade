import { v4 as uuidv4 } from "uuid";
import { referencedSecrets, secretStore } from "hkp-frontend/src/core/secrets";

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
function secretsFor(
  services: Array<{ state?: unknown }> | undefined,
): Record<string, { value: string; audience?: string[] }> {
  const store = secretStore();
  const payload: Record<string, { value: string; audience?: string[] }> = {};
  for (const alias of referencedSecrets(services ?? [])) {
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
 * Provisioning carries these already; this covers the two moments it cannot —
 * a vault entry edited while a board runs, and attaching to a runtime that
 * restarted, where the services survived and the values did not. Sending
 * nothing is not an error: a board with no references has nothing to push.
 */
export async function pushSecrets(
  runtime: RuntimeDescriptor,
  services: Array<{ state?: unknown }> | undefined,
  user: User | null,
): Promise<void> {
  const secrets = secretsFor(services);
  if (!Object.keys(secrets).length) {
    return;
  }
  try {
    await fetch(`${runtime.url}/runtimes/${runtime.id}/secrets`, {
      method: "PUT",
      body: JSON.stringify(secrets),
      headers: { "content-type": "application/json", ...authHeaders(user) },
    });
  } catch {
    // A runtime that cannot be reached is reported by everything else the
    // caller is doing; a failed push costs the credentials, and the services
    // needing them say so themselves.
  }
}

async function attachRuntime(
  runtime: RuntimeDescriptor,
  // State included: attaching re-pushes the values for the references it
  // carries, which cannot be read off a uuid alone.
  services: Array<{ uuid: string; serviceId: string; state?: unknown }>,
  user: User | null,
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
  scope.services = existing.services;
  // A runtime that restarted still has its services and no longer has their
  // credentials, and nothing here can tell that apart from one that never
  // stopped. Pushing again is idempotent, so it is done either way.
  await pushSecrets(descriptor, services, user);
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
): Promise<RestoreRuntimeResult | null> {
  const svcs = (services ?? []).map((s) => ({
    uuid: s.uuid || uuidv4(),
    serviceName: s.serviceName,
    serviceId: s.serviceId,
    state: (s as any).state, // TODO:
  }));

  const attached = await attachRuntime(runtime, svcs, user);
  if (attached) {
    return attached;
  }

  const {
    registry,
    scope,
    services: createdServices,
  } = await createRuntimeRequest(runtime, svcs, boardName, user);
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

  if (
    !scope.sendMessageViaWebsocket(params, startedRun(context), "processRuntime")
  ) {
    // if sending failed, we probably don't have a runtimeOutput, we send a REST request
    // TODO what if params is not an object?
    const res = await fetch(`${runtime.url}/runtimes/${runtime.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(scope.authenticatedUser),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to process ${runtime.id} runtime: ${res.statusText}`,
      );
    }
  }
}

export async function addService(scope: RuntimeScope, service: ServiceClass) {
  const runtime = scope.descriptor;
  const restScope = scope as RuntimeRestScope;
  const scopeRegistry = restScope.registry || [];
  const descriptor =
    scopeRegistry.find((entry) => entry.serviceId === service.serviceId) ||
    service;
  const payload = {
    ...descriptor,
    uuid: uuidv4(),
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
    secrets: secretsFor(services),
  };
  const runtimesUrl = `${runtime.url}/runtimes`;
  let res: Response;
  try {
    res = await fetch(runtimesUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        ...authHeaders(user ?? null),
      },
    });
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
  const { registry, runtimes } = await res.json();
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
  scope.services = rt.services ?? [];

  return {
    runtime: rt,
    services: rt.services,
    scope,
    registry: normalizedRegistry,
  };
}

const api: RuntimeApi = {
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
};

export default api;
