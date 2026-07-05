import {
  ServiceClass,
  RuntimeDescriptor,
  ServiceDescriptor,
  ServiceInstance,
  InstanceId,
  isRuntimeBrowserClassType,
} from "../types";
import { reorderService } from "../views/playground/BoardActions";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";

export async function addService(
  service: ServiceClass,
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
  const svc = await api.addService(scope, service, prototype?.uuid);
  if (svc) {
    const currentList = refs.servicesRef.current![runtime.id];
    if (insertAtIndex !== undefined) {
      const newList = [...currentList];
      newList.splice(insertAtIndex, 0, svc);
      refs.setServices((prev) => ({ ...prev, [runtime.id]: newList }));
      const rearranged = await api.rearrangeServices(scope, newList);
      if (rearranged) {
        refs.setServices((prev) => ({ ...prev, [runtime.id]: rearranged }));
      }
    } else {
      refs.setServices((prev) => ({
        ...prev,
        [runtime.id]: prev[runtime.id].concat(svc),
      }));
    }
  }
  if (prototype) {
    await api.configureService(
      scope,
      prototype,
      prototype.state || prototype,
    );
  } else if (svc && isRuntimeBrowserClassType(runtime.type)) {
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
