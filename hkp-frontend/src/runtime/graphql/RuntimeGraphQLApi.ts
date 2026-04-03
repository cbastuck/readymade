import {
  createRuntime,
  restoreRuntime as restoreRuntime_gql,
  createRuntimeService,
  removeRuntimeService,
  getRuntimeServiceConfig,
  configureService as configureService_gql,
  processRuntime as processRuntime_gql,
  rearrangeServices as rearrangeServices_gql,
  getRuntimeOutputUrl,
  getHealth as getHealth_gql,
} from "./graphqlActions";
import {
  InstanceId,
  ProcessContext,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceClass,
  ServiceDescriptor,
  User,
} from "../../types";
import RuntimeGraphQLScope from "./RuntimeGraphQLScope";

export async function isUserAuthenticated(
  rtClass: RuntimeClass,
  user?: User | null,
) {
  const healthStatus = await getHealth(rtClass, user || null);
  if (healthStatus === "200") {
    return true;
  } else if (healthStatus === "401") {
    return false;
  } else {
    console.error(
      `RuntimeGraphQLApi.isUserAuthenticated reports unexpected status: ${healthStatus}`,
    );
    return false;
  }
}

export async function getHealth(rtClass: RuntimeClass, user: User | null) {
  return getHealth_gql(rtClass, user);
}

export async function addRuntime(
  rtClass: RuntimeClass,
  user: User | null,
  boardName?: string,
) {
  const desc = await createRuntime(rtClass, user);
  if (!desc) {
    return null;
  }

  const { registry, ...rest } = desc;
  const runtime = { ...rtClass, ...rest, user, boardName };
  const scope = await createScope(runtime);
  return {
    runtime,
    services: [],
    registry,
    scope,
  };
}

export async function removeRuntime(
  _scope_: RuntimeScope,
  _rt: RuntimeDescriptor,
  _user: User | null,
): Promise<void> {
  throw new Error("RuntimeGraphQL removeRuntime no implemented");
}

export async function restoreRuntime(
  rt: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  user: User | null,
  boardName?: string,
) {
  const restoredRuntime = await restoreRuntime_gql(rt, services, user);
  if (!restoredRuntime || restoredRuntime.id !== rt.id) {
    return null;
  }

  const restoredServices = restoredRuntime.services.map(
    ({ config, instanceId, ...rest }: any) => {
      const { bypass, ...state } = JSON.parse(config);
      return {
        ...rest,
        uuid: instanceId,
        bypass,
        state,
      };
    },
  );

  const runtime = { ...rt, ...restoredRuntime, user, boardName };

  const scope = await createScope(runtime);
  return {
    runtime,
    services: restoredServices,
    scope,
    registry: restoredRuntime.registry,
  };
}

export async function processRuntime(
  scope_: RuntimeScope,
  params: any,
  svc: InstanceId | null,
  context?: ProcessContext | null,
): Promise<void> {
  const scope = scope_ as RuntimeGraphQLScope;
  if (!scope.isConnected()) {
    await scope.reconnect();
  }
  if (context) {
    scope.registerProcessContext(context);
  }
  return processRuntime_gql(scope.descriptor, params, svc, context);
}

export async function addService(scope: RuntimeScope, service: ServiceClass) {
  const svc = await createRuntimeService(scope.descriptor, service);
  return svc;
}

export async function removeService(
  scope: RuntimeScope,
  service: InstanceId,
): Promise<Array<ServiceDescriptor> | null> {
  return await removeRuntimeService(scope.descriptor, service);
}

export async function configureService(
  scope: RuntimeScope,
  service: InstanceId,
  config: object,
): Promise<object> {
  return await configureService_gql(scope.descriptor, service, config);
}

export async function getServiceConfig(
  scope: RuntimeScope,
  service: InstanceId,
): Promise<any> {
  const config = await getRuntimeServiceConfig(scope.descriptor, service);
  return config;
}

export async function processService(
  _scope: RuntimeScope,
  _service: InstanceId,
  _params: any,
  _context?: ProcessContext | null,
): Promise<any> {
  throw new Error("RuntimeGraphQL processService no implemented");
}

export async function rearrangeServices(
  scope: RuntimeScope,
  newOrder: Array<ServiceDescriptor>,
): Promise<Array<ServiceDescriptor>> {
  const rearranged = await rearrangeServices_gql(scope.descriptor, newOrder);
  return rearranged.map((svc) => newOrder.find((s) => s.uuid === svc.uuid)!);
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
  getHealth,
  rearrangeServices,
};

export default api;

async function createScope(
  runtime: RuntimeDescriptor,
): Promise<RuntimeGraphQLScope> {
  const outputUrl = await getRuntimeOutputUrl(runtime);
  return new RuntimeGraphQLScope(runtime, outputUrl);
}
