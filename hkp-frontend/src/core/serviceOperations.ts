import {
  ServiceClassWithPreset,
  RuntimeDescriptor,
  ServiceDescriptor,
  ServiceInstance,
  InstanceId,
  isRuntimeBrowserClassType,
} from "../types";
import { presetsForService } from "../presetRegistry";
import { presetState } from "./presets";
import { withNewUse } from "../runtime/board/blocks";
import { reorderService } from "../views/playground/BoardActions";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";

export async function addService(
  service: ServiceClassWithPreset,
  runtime: RuntimeDescriptor,
  refs: BoardStateRefs,
  prototype?: ServiceInstance,
  insertAtIndex?: number,
): Promise<ServiceDescriptor | null> {
  const [scope, api] = getRuntimeScopeApi(runtime.id, refs);
  if (!api || !scope) {
    throw new Error(
      `BoardContext.addService() runtime api is missing: ${runtime.type}`,
    );
  }
  // A palette entry standing for a preset is called what the preset is called,
  // and so is what it creates: the service is named at creation rather than
  // renamed into it afterwards.
  const preset = service.preset
    ? presetsForService(service.preset.serviceId).find(
        (entry) => entry.id === service.preset!.id,
      )
    : undefined;
  // A block is used, not applied: what is created is what a use of it
  // expands to, and linkage records the use so saving writes it back.
  const blocks = refs.linkageRef?.current?.blocks;
  const blockDocument = runtime.unit ?? "";
  const definition = service.block
    ? blocks?.definitions[blockDocument]?.find((entry) => entry.id === service.block!.id)
    : undefined;
  if (service.block && (!blocks || !definition)) {
    throw new Error(`No block "${service.block.id}" to add to runtime "${runtime.id}"`);
  }

  const created = await api.addService(
    scope,
    preset
      ? { ...service, serviceName: preset.name }
      : definition
        ? { ...service, serviceId: definition.serviceId, serviceName: definition.name }
        : service,
    prototype?.uuid,
  );

  // Configured before the board is told the service exists. A panel reads a
  // service's configuration once, when it first sees the instance; published
  // first, it would read the defaults and never hear this (see core/presets).
  //
  // The descriptor is then re-read, because it is not only a panel that reads
  // the state: a board descriptor carries the state it was created with, and a
  // nested pipeline is rendered straight off it (SubServicePipelineUI). Publish
  // the one the create answered with and a sub-service configured from a preset
  // shows as empty while its runtime holds the whole pipeline.
  let svc = created;
  if (created && definition && blocks) {
    const placed = withNewUse(blocks, {
      runtimeId: runtime.id,
      document: blockDocument,
      arrayPath: [runtime.id],
      use: { block: definition.id, uuid: created.uuid },
      id: created.uuid,
    });
    await api.configureService(scope, created, placed.service.state);
    refs.setLinkage((prev) => (prev ? { ...prev, blocks: placed.linkage } : prev));
    const state = await Promise.resolve(
      api.getServiceConfig?.(scope, created),
    ).catch(() => null);
    svc = { ...created, serviceName: placed.service.serviceName, ...(state ? { state } : {}) };
  } else if (created && preset) {
    await api.configureService(scope, created, presetState(preset));
    const state = await Promise.resolve(
      api.getServiceConfig?.(scope, created),
    ).catch(() => null);
    if (state) {
      svc = { ...created, state };
    }
  }

  if (svc) {
    const added = svc;
    const currentList = refs.servicesRef.current![runtime.id];
    if (insertAtIndex !== undefined) {
      const newList = [...currentList];
      newList.splice(insertAtIndex, 0, added);
      refs.setServices((prev) => ({ ...prev, [runtime.id]: newList }));
      const rearranged = await api.rearrangeServices(scope, newList);
      if (rearranged) {
        refs.setServices((prev) => ({ ...prev, [runtime.id]: rearranged }));
      }
    } else {
      refs.setServices((prev) => ({
        ...prev,
        [runtime.id]: prev[runtime.id].concat(added),
      }));
    }
  }
  if (prototype) {
    await api.configureService(
      scope,
      prototype,
      prototype.state || prototype,
    );
  } else if (svc && !preset && !definition && isRuntimeBrowserClassType(runtime.type)) {
    // Initialise a freshly inserted browser service with an initial configure,
    // symmetric with restore (which configures every service on load). Without
    // it, a service that establishes a side effect in configure() — e.g.
    // PeerSocket opening its signaling connection — would stay dormant until the
    // user next changed its configuration. Restore uses a different add path
    // (BrowserRuntimeApi.restoreRuntime) and configures with the persisted
    // state, so this does not double-configure restored services.
    await api.configureService(scope, svc, {});
  }

  return svc;
}

export async function removeService(
  service: InstanceId,
  runtime: RuntimeDescriptor,
  refs: BoardStateRefs,
): Promise<void> {
  const [scope, api] = getRuntimeScopeApi(runtime.id, refs);
  if (!api || !scope) {
    throw new Error(
      `BoardContext.removeService() runtime api is missing: ${runtime.type}`,
    );
  }

  const propsRef = refs.propsRef.current!;
  if (propsRef.onRemoveService) {
    propsRef.onRemoveService(service, runtime);
  }
  await api.removeService(scope, service);

  refs.setServices((prev) => ({
    ...prev,
    [runtime.id]: prev[runtime.id].filter(
      (svc) => svc.uuid !== service.uuid,
    ),
  }));
}

export async function removeAllServices(
  runtime: RuntimeDescriptor,
  refs: BoardStateRefs,
): Promise<void> {
  for (const service of refs.servicesRef.current![runtime.id]) {
    await removeService(service, runtime, refs);
  }

  refs.setServices((prev) => ({
    ...prev,
    [runtime.id]: [],
  }));
}

export async function arrangeServices(
  runtime: RuntimeDescriptor,
  serviceUuid: string,
  targetPosition: number,
  refs: BoardStateRefs,
): Promise<void> {
  const [scope, api] = getRuntimeScopeApi(runtime.id, refs);
  if (!scope || !api) {
    throw new Error("BoardContext.arrangeServices, scope or api missing");
  }

  const currentServices = refs.servicesRef.current!;
  const rearranged = await api.rearrangeServices(
    scope,
    reorderService(currentServices, runtime, serviceUuid, targetPosition),
  );

  refs.setServices((prev) => ({
    ...prev,
    [runtime.id]: rearranged,
  }));
}

export async function setServiceName(
  runtimeId: string,
  instanceId: string,
  newName: string,
  refs: BoardStateRefs,
): Promise<void> {
  const rt = refs.runtimesRef.current!.find((r) => r.id === runtimeId);
  if (!rt || rt.type !== "browser") {
    throw new Error(
      "BoardContext.setServiceName() only supported for browser runtimes",
    );
  }
  const svc = refs.servicesRef.current![rt.id]?.find(
    (s) => s.uuid === instanceId,
  );
  if (!svc) {
    throw new Error(
      `BoardContext.setServiceName() service not found: ${instanceId}"`,
    );
  }

  refs.setServices((prev) => ({
    ...prev,
    [rt.id]: prev[rt.id].map((s) =>
      s.uuid === instanceId
        ? {
            ...s,
            serviceName: newName,
          }
        : s,
    ),
  }));
}
