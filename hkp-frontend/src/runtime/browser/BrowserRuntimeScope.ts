import { AppImpl, InstanceId, RuntimeScope, ServiceImpl } from "../../types";
import BrowserRegistry from "./BrowserRegistry";
import { createBrowserRuntimeApp } from "./BrowserRuntimeApp";

type InstanceIndexTuple = [ServiceImpl | null, number];

export default class BrowserRuntimeScope implements RuntimeScope {
  serviceInstances: Array<ServiceImpl>;
  subservices: {
    [uuid: string]: { service: ServiceImpl; parent: ServiceImpl };
  };
  app: AppImpl;
  registry: BrowserRegistry;

  constructor(registry: BrowserRegistry) {
    this.registry = registry;
    this.serviceInstances = [];
    this.subservices = {};
    this.app = createBrowserRuntimeApp(this);
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    instanceId: string | null,
    result: any,
    requestId: string | null
  ): Promise<void> => {
    throw new Error("BrowserRuntimeScope.onResult not implemented");
  };

  findServiceInstance = (uuid: string | null): InstanceIndexTuple => {
    if (uuid === null) {
      return [this.serviceInstances[0], 0];
    }
    const idx = this.serviceInstances.findIndex((i) => i.uuid === uuid);
    return idx === -1 ? [null, -1] : [this.serviceInstances[idx], idx];
  };

  appendService = (svc: ServiceImpl) => {
    this.serviceInstances.push(svc);
  };

  removeSubservices = async () => {
    for (const ssvcUuid of Object.keys(this.subservices)) {
      const ssvc = this.subservices[ssvcUuid];
      if (ssvc.service.destroy) {
        await ssvc.service.destroy();
      }
    }
    this.subservices = {};
  };

  // service parameter can be null, then starts with the first service
  next = async (
    service: InstanceId | null,
    params: any,
    requestId: string | null = null,
    advanceBeforeProcess: boolean = true
  ) => {
    const services = this.serviceInstances;
    let [svc, position] = this.findServiceInstance(service?.uuid || null);
    if (position === -1) {
      return console.error(
        `Called next() in browser but could not find current service: ${
          service?.uuid
        } in scope: ${JSON.stringify(this)}`
      );
    }

    let result = params;
    for (
      let i = advanceBeforeProcess ? position + 1 : position;
      !!services[i] && result !== null;
      ++i
    ) {
      svc = services[i];
      if (svc && !svc.bypass) {
        try {
          result = await svc.process(params);
          params = result;
        } catch (err) {
          /*console.error(
            `Seriously: service ${JSON.stringify(
              serviceInstance
            )} caused error: `,
            err
          );*/
        }
      }
    }

    await this.onResult(svc ? svc.uuid : null, result, requestId);
    return result;
  };
}
