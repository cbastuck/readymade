import {
  createRuntime,
  restoreRuntime,
  createRuntimeService,
} from "./graphqlActions";
import {
  InstanceId,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceClass,
  ServiceDescriptor,
} from "../../types";
import RemoteRuntimeScope from "./RemoteRuntimeScope";

const api: RuntimeApi = {
  addRuntime: async (rtClass: RuntimeClass) => {
    const desc = await createRuntime(rtClass);
    if (!desc) {
      return null;
    }

    const scope = createScope(desc.id);
    const { registry, ...runtime } = desc;
    return {
      runtime: { ...rtClass, ...runtime },
      services: [],
      registry,
      scope,
    };
  },
  restoreRuntime: async (
    rt: RuntimeDescriptor,
    services: Array<ServiceDescriptor>
  ) => {
    const result = await restoreRuntime(rt, services);

    const scope = createScope(rt.id);
    console.log("REMOTE RUNTIME RESTORED", result, scope);

    return { runtime: rt, services, scope };
  },
  processRuntime: (
    scope: RuntimeScope,
    params: any,
    svc: InstanceId | null
  ): Promise<any> => {
    throw new Error("RemoteRuntime processRuntime no implemented");
  },
  addService: async (
    scope_: RuntimeScope,
    runtime: RuntimeDescriptor,
    service: ServiceClass
  ) => {
    const svc = await createRuntimeService(runtime, service);
    return svc;
  },
  removeService: (
    scope: RuntimeScope,
    service: InstanceId,
    runtime: RuntimeDescriptor
  ): Promise<boolean> => {
    throw new Error("RemoteRuntime removeService no implemented");
  },
  configureService: (
    scope: RuntimeScope,
    instanceId: string,
    config: any
  ): Promise<void> => {
    throw new Error("RemoteRuntime configureService no implemented");
  },
  getServiceConfig: (scope: RuntimeScope, uuid: string): Promise<any> => {
    throw new Error("RemoteRuntime getServiceConfig no implemented");
  },
  processService: (
    scope: RuntimeScope,
    uuid: string,
    params: any,
    requestId: string | null
  ): Promise<any> => {
    throw new Error("RemoteRuntime processService no implemented");
  },
};

function createScope(runtimeId: string): RemoteRuntimeScope {
  return new RemoteRuntimeScope(runtimeId);
}

export default api;
