import {
  createRuntime,
  restoreRuntime,
  createRuntimeService,
} from "./graphqlActions";
import {
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceClass,
  ServiceDescriptor,
} from "../../types";

const api: RuntimeApi = {
  restoreRuntime: async (
    rt: RuntimeDescriptor,
    services: Array<ServiceDescriptor>
  ) => {
    const result = await restoreRuntime(rt, services);
    console.log("REMOTE RUNTIME RESTORED", result);
    return { runtime: rt, services };
  },
  addService: async (runtime: RuntimeDescriptor, service: ServiceClass) => {
    const svc = await createRuntimeService(runtime, service);
    return svc;
  },
  addRuntime: async (rtClass: RuntimeClass) => {
    const desc = await createRuntime(rtClass);
    if (!desc) {
      return null;
    }

    const { registry, ...runtime } = desc;
    return { runtime: { ...rtClass, ...runtime }, services: [], registry };
  },
};

export default api;
