import { v4 as uuidv4 } from "uuid";
import {
  RuntimeScope,
  Bundles,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  InstanceId,
  ServiceClass,
  RestoreRuntimeResult,
  ServiceInstance,
  User,
  ProcessContext,
  ServiceDescriptor,
} from "../../types";
import BrowserRegistry from "./BrowserRegistry";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import { filterPrivateMembers } from "./services/helpers";
import { defaultBundles } from "./registry/Default";

export async function addRuntime(
  rtClass: RuntimeClass,
  _user: User | null,
  boardName?: string
) {
  const { name: passedName, type, url } = rtClass;
  const runtimeId = uuidv4();
  const runtime = {
    id: runtimeId,
    name: passedName || "Browser Runtime",
    type,
    url,
    boardName,
  };

  const scope = await createScope(runtime, rtClass.bundles);
  return {
    runtime,
    services: [],
    registry: scope.registry.allowedServices(),
    scope,
  };
}

export async function removeRuntime(
  scope: RuntimeScope,
  _runtime: RuntimeDescriptor,
  _user: User | null
): Promise<void> {
  const scope_ = scope as BrowserRuntimeScope;
  for (const service of scope_.serviceInstances) {
    await removeService(scope, service);
  }
}

async function restoreRuntime(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  _user: User | null,
  boardName?: string
): Promise<RestoreRuntimeResult | null> {
  const scope = await createScope(runtime, runtime.bundles);
  const createdServices: Array<ServiceInstance> = (
    await Promise.all(services.map((svc) => addService(scope, svc, svc.uuid)))
  ).filter((svc) => {
    return svc && scope.findServiceInstance(svc.uuid);
  }) as any;

  setTimeout(
    () =>
      Promise.all(
        createdServices.map((svc, idx) =>
          configureService(scope, svc, services[idx])
        )
      ),
    5
  );

  return {
    runtime: { ...runtime, boardName },
    services,
    registry: scope.registry.allServices(), // TODO: this is not used
    scope,
  };
}

export function processRuntime(
  scope_: RuntimeScope,
  params: any,
  svc: InstanceId | null,
  context?: ProcessContext | null
) {
  const scope = scope_ as BrowserRuntimeScope;
  return scope.next(svc, params, context, false);
}

export async function addService(
  scope_: RuntimeScope,
  service: ServiceClass,
  instanceId?: string
): Promise<ServiceDescriptor | null> {
  const scope = scope_ as BrowserRuntimeScope;
  const [svc, descriptor] = createService(scope, service, instanceId) || [];
  if (!svc || !descriptor) {
    return null;
  }
  scope.appendService(svc);
  return descriptor;
}

export async function removeService(
  scope_: RuntimeScope,
  instance: InstanceId
): Promise<Array<ServiceDescriptor> | null> {
  const scope = scope_ as BrowserRuntimeScope;
  const [service] = scope.findServiceInstance(instance.uuid);
  if (!service) {
    console.error(
      `Could not find browser service to process: ${
        instance.uuid
      } in scope: ${JSON.stringify(scope)}`
    );
    return null;
  }

  return await scope.removeService(service);
}

export async function configureService(
  scope_: RuntimeScope,
  service: InstanceId,
  config: any
): Promise<void> {
  const scope = scope_ as BrowserRuntimeScope;
  const [svc] = scope.findServiceInstance(service.uuid);
  if (svc) {
    return svc.configure?.(config);
  }
}

export async function getServiceConfig(
  scope_: RuntimeScope,
  service: InstanceId
): Promise<any> {
  const scope = scope_ as BrowserRuntimeScope;
  const [svc] = scope.findServiceInstance(service.uuid);
  if (svc) {
    if (svc.getConfiguration) {
      return await svc.getConfiguration();
    } else if (svc.state) {
      return svc.state;
    } else {
      return filterPrivateMembers(svc);
    }
  } else {
    return {};
  }
}

export async function processService(
  scope_: RuntimeScope,
  svc: InstanceId,
  params: any,
  context?: ProcessContext | null
) {
  const scope = scope_ as BrowserRuntimeScope;
  const { uuid } = svc;
  const [service, position] = scope.findServiceInstance(uuid);
  if (position === -1) {
    return console.error(
      `Could not find browser service to process: ${uuid} in scope: ${JSON.stringify(
        scope
      )}`
    );
  }

  // TODO: this is not true since a long time, right?
  // if it's not an object it's a binary buffer base64 encoded
  /*
  const data = typeof params === 'string' ?
    new Blob(
      [decode(params)], 
      { type: 'application/octet-binary' }
    ) :
    params;
    */

  const data = params;
  if (service) {
    return scope.next(service, data, context, false);
  }
}

export async function appendSubservice(
  scope_: RuntimeScope,
  service: ServiceClass,
  parent: ServiceInstance,
  instanceId?: string
): Promise<ServiceInstance | null> {
  const scope = scope_ as BrowserRuntimeScope;
  const [ssvc] = createService(scope, service, instanceId) || [];
  if (ssvc) {
    scope.subservices[ssvc.uuid] = { service: ssvc, parent };
    return ssvc;
  }
  return null;
}

async function createScope(
  runtime: RuntimeDescriptor,
  bundles: Bundles = defaultBundles
): Promise<BrowserRuntimeScope> {
  const registry = await BrowserRegistry.create(bundles);
  return new BrowserRuntimeScope(runtime, registry);
}

function createService(
  scope: BrowserRuntimeScope,
  service: ServiceClass,
  instanceId?: string
): [ServiceInstance, ServiceDescriptor] | null {
  const module = scope.registry.findServiceModule(service.serviceId);
  if (!module) {
    console.error(
      `Could not create service: ${JSON.stringify(
        service
      )} in scope: ${JSON.stringify(scope)}`
    );
    return null;
  }
  const useInstanceId = instanceId || uuidv4();
  const svc: ServiceInstance = module.create(
    scope.app,
    "deprecated boardname - get it from app",
    module,
    useInstanceId
  );
  if (!svc) {
    console.error(`Could not create service module: ${JSON.stringify(module)}`);
    return null;
  }
  svc.serviceName = service.serviceName || module.serviceName;
  svc.serviceId = module.serviceId;

  const descriptor = {
    ...module,
    uuid: useInstanceId,
    serviceName: service.serviceName || module.serviceName,
  };
  svc.__descriptor = descriptor; // TODO: remote this __descriptor
  const configure = svc.configure?.bind(svc);
  svc.configure = (config: any) => {
    // monkey wire configure
    const { bypass } = config || {};
    if (bypass !== undefined) {
      svc.bypass = bypass;
      scope.app.notify(svc, { bypass });
    }
    return configure && configure(config.state ? config.state : config || {});
  };

  return [svc, descriptor];
}

function rearrangeServices(
  scope_: RuntimeScope,
  rearranged: Array<ServiceDescriptor>
): Promise<Array<ServiceDescriptor>> {
  const scope = scope_ as BrowserRuntimeScope;
  scope.rearrangeServices(rearranged);
  return Promise.resolve(rearranged);
}

const api: RuntimeApi = {
  addRuntime,
  removeRuntime,
  restoreRuntime,
  processRuntime,
  addService,
  removeService,
  configureService,
  getServiceConfig,
  processService,
  rearrangeServices,
};

export default api;
