import { BoardContextState } from "@/BoardContext";

type Id = string | number;

let firstRun = true;

export function connectDevTools(context?: BoardContextState) {
  if (!context) {
    return;
  }

  const getRuntimeApi = (runtimeId: Id) => {
    const rt = getRuntime(runtimeId);
    const api = rt && context.runtimeApis[rt?.type];
    if (!api) {
      throw new Error(`Runtime not exist: ${runtimeId}`);
    }
    const scope = rt && context.scopes[rt.id];
    if (!scope) {
      throw new Error(`Scope does not exist for runtime: ${rt.id}`);
    }
    return { api, rt, scope };
  };

  const getServiceApi = (runtimeId: Id, instanceId: Id) => {
    const { rt, scope, api } = getRuntimeApi(runtimeId);
    const svc = rt && api && scope && getService(runtimeId, instanceId);
    if (!svc) {
      throw new Error(`Service does not exist ${instanceId}`);
    }
    return { api, rt, scope, svc };
  };

  const getRuntime = (runtimeId: Id) => {
    return typeof runtimeId === "number"
      ? context.runtimes[runtimeId]
      : context.runtimes.find((rt) => rt.id === runtimeId) ||
          context.runtimes.find((rt) => rt.name === runtimeId);
  };

  const getRuntimes = () => {
    return context.runtimes;
  };

  const getServices = (runtimeId: Id) => {
    const rt = getRuntime(runtimeId);
    return rt ? context.services[rt.id] : undefined;
  };

  const getService = (runtimeId: Id, instanceId: Id) => {
    const rt = getRuntime(runtimeId);
    if (!rt) {
      return undefined;
    }
    const instances = context.services[rt.id];
    return typeof instanceId === "number"
      ? instances[instanceId]
      : instances.find((i) => i.uuid === instanceId) ||
          instances.find((i) => i.serviceName === instanceId);
  };

  const getServiceConfig = (runtimeId: Id, instanceId: Id) => {
    const rt = getRuntime(runtimeId);
    const svc = rt && getService(runtimeId, instanceId);
    const api = rt && svc && context.runtimeApis[rt?.type];
    return api
      ? api.getServiceConfig(context.scopes[rt.id], { uuid: svc.uuid })
      : undefined;
  };

  const setServiceConfig = async (
    runtimeId: Id,
    instanceId: Id,
    config: any
  ) => {
    const { api, rt, svc } = getServiceApi(runtimeId, instanceId);
    return api && rt && svc
      ? await api.configureService(
          context.scopes[rt.id],
          { uuid: svc.uuid },
          config
        )
      : undefined;
  };

  const processRuntime = (runtimeId: Id, params: any) => {
    const { api } = getRuntimeApi(runtimeId);
    return api.processRuntime(context.scopes[runtimeId], params, null);
  };

  const processService = (runtimeId: Id, instanceId: Id, params: any) => {
    const { api, rt, svc } = getServiceApi(runtimeId, instanceId);
    return api.processService(
      context.scopes[rt.id],
      { uuid: svc.uuid },
      params,
      null
    );
  };

  const processNext = (runtimeId: Id, instanceId: Id, params: any) => {
    return new Promise((resolve, reject) => {
      try {
        const { svc, scope } = getServiceApi(runtimeId, instanceId);
        const resolver = (res: any) => () => resolve(res);
        scope.onResult(svc.uuid, params, null, resolver);
      } catch (err) {
        reject(err);
      }
    });
  };

  const api = {
    getRuntime,
    getRuntimes,
    getServices,
    getService,
    getServiceConfig,
    setServiceConfig,
    processRuntime,
    processService,
    processNext,
  };

  if (firstRun) {
    console.log(
      `Welcome to Hkp \n The following APIs are supported:
      ${Object.keys(api)
        .map((x) => `\n- ${x}`)
        .join("")}`
    );
    firstRun = false;
  }

  const global: any = window;
  global["hkp"] = api;
}
