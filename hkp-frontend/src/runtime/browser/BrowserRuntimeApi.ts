import * as uuid from "uuid";
import UAParser from "ua-parser-js";
import {
  RuntimeScope,
  Bundles,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceDescriptor,
  InstanceId,
  ServiceClass,
  RestoreRuntimeResult,
  ServiceImpl,
} from "../../types";
import BrowserRegistry from "./BrowserRegistry";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import { filterPrivateMembers } from "./services/helpers";

export async function addRuntime(rtClass: RuntimeClass) {
  const { name: passedName, type, url } = rtClass;
  const runtimeId = uuid.v4();
  const browser = new UAParser().getBrowser();
  const runtime = {
    id: runtimeId,
    name: browser.name || passedName,
    type,
    url,
  };

  const scope = await createScope(runtimeId, rtClass.bundles);
  return {
    runtime,
    services: [],
    registry: scope.registry.allowedServices(),
    scope,
  };
}

async function restoreRuntime(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>
): Promise<RestoreRuntimeResult | null> {
  const scope = await createScope(runtime.id, runtime.bundles);
  const createdServices: Array<ServiceImpl> = (
    await Promise.all(
      services.map((svc) => addService(scope, runtime, svc, svc.uuid))
    )
  ).filter((svc) => svc && scope.findServiceInstance(svc.uuid)) as any;

  const configuredServices = await Promise.all(
    createdServices.map((svc, idx) =>
      configureService(scope, svc.uuid, services[idx]).then(() => services[idx])
    )
  );
  return {
    runtime,
    services: configuredServices,
    registry: scope.registry.allowedServices(),
    scope,
  };
}

export function processRuntime(
  scope_: RuntimeScope,
  params: any,
  svc: InstanceId | null
) {
  const scope = scope_ as BrowserRuntimeScope;
  return scope.next(svc, params, null, false);
}

export async function addService(
  scope_: RuntimeScope,
  rt: RuntimeDescriptor,
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
): Promise<boolean> {
  const scope = scope_ as BrowserRuntimeScope;
  const [service] = scope.findServiceInstance(instance.uuid);
  if (!service) {
    console.error(
      `Could not find browser service to process: ${uuid} in scope: ${JSON.stringify(
        scope
      )}`
    );
    return false;
  }

  if (service.destroy) {
    service.destroy();
  }

  return true;
}

export async function configureService(
  scope_: RuntimeScope,
  uuid: string,
  config: any
): Promise<void> {
  const scope = scope_ as BrowserRuntimeScope;
  const [svc] = scope.findServiceInstance(uuid);
  if (svc) {
    return svc.configure(config);
  }
}

export async function getServiceConfig(
  scope_: RuntimeScope,
  uuid: string
): Promise<any> {
  const scope = scope_ as BrowserRuntimeScope;
  const [svc] = scope.findServiceInstance(uuid);
  const config = svc ? filterPrivateMembers(svc) : {};
  return config;
}

export async function processService(
  scope_: RuntimeScope,
  uuid: string,
  params: any,
  requestId: string | null
) {
  const scope = scope_ as BrowserRuntimeScope;
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
    return scope.next(service, data, requestId, false);
  }
}

export async function appendSubservice(
  scope_: RuntimeScope,
  service: ServiceDescriptor,
  parent: ServiceImpl
) {
  const scope = scope_ as BrowserRuntimeScope;
  const [ssvc] = createService(scope, service) || [];
  if (ssvc) {
    scope.subservices[ssvc.uuid] = { service: ssvc, parent };
    return ssvc;
  }
  return null;
}

async function createScope(
  runtimeId: string,
  bundles?: Bundles
): Promise<BrowserRuntimeScope> {
  const registry = await BrowserRegistry.create(bundles);
  return new BrowserRuntimeScope(runtimeId, registry);
}

function createService(
  scope: BrowserRuntimeScope,
  service: ServiceClass,
  instanceId?: string
): [ServiceImpl, ServiceDescriptor] | null {
  const module = scope.registry.findServiceModule(service.serviceId);
  if (!module) {
    console.error(
      `Could not create service: ${
        service.serviceId
      } in scope: ${JSON.stringify(scope)}`
    );
    return null;
  }
  const useInstanceId = instanceId || uuid.v4();
  const svc: ServiceImpl = module.create(
    scope.app,
    "deprecated boardname - get it from app",
    module,
    useInstanceId
  );
  if (!svc) {
    console.error(`Could not create service module: ${JSON.stringify(module)}`);
    return null;
  }
  const descriptor = {
    ...module,
    uuid: useInstanceId,
    serviceName: service.serviceName || module.serviceName,
  };
  svc.__descriptor = descriptor;
  const configure = svc.configure.bind(svc);
  svc.configure = (config: any) => {
    // monkey wire configure
    const { bypass } = config || {};
    if (bypass !== undefined) {
      svc.bypass = bypass;
      scope.app.notify(svc, { bypass });
    }
    return configure && configure(config || {});
  };

  return [svc, descriptor];
}

const api: RuntimeApi = {
  addRuntime,
  restoreRuntime,
  processRuntime,

  addService,
  removeService,
  configureService,
  getServiceConfig,
  processService,
};

export default api;
