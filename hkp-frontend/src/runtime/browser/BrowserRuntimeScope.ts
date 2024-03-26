import {
  AppImpl,
  InstanceId,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
  ServiceImpl,
  User,
} from "../../types";
import BrowserRegistry from "./BrowserRegistry";
import { createBrowserRuntimeApp } from "./BrowserRuntimeApp";

export type InstanceIndexTuple = [ServiceImpl | null, number];

export default class BrowserRuntimeScope implements RuntimeScope {
  descriptor: RuntimeDescriptor;
  serviceInstances: Array<ServiceImpl>;
  subservices: {
    [uuid: string]: { service: ServiceImpl; parent: ServiceImpl };
  };
  app: AppImpl;
  registry: BrowserRegistry;
  authenticatedUser: User | null = null;

  constructor(runtime: RuntimeDescriptor, registry: BrowserRegistry) {
    this.descriptor = runtime;
    this.registry = registry;
    this.serviceInstances = [];
    this.subservices = {};
    this.app = createBrowserRuntimeApp(this);
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    _instanceId: string | null,
    _result: any,
    _requestId: string | null,
    _resultCallback: null | ((p: any) => void)
  ): Promise<void> => {
    console.warn("BrowserRuntimeScope.onResult not set");
  };

  findServiceInstance = (uuid: string | null): InstanceIndexTuple => {
    if (uuid === null) {
      return [this.serviceInstances[0], 0];
    }

    const { parent } = this.subservices[uuid] || {};
    const searchUuid = parent ? parent.uuid : uuid;
    const idx = this.serviceInstances.findIndex((i) => i.uuid === searchUuid);
    return idx === -1 ? [null, -1] : [this.serviceInstances[idx], idx];
  };

  appendService = (svc: ServiceImpl) => {
    this.serviceInstances.push(svc);
  };

  removeService = async (
    service: ServiceImpl
  ): Promise<Array<ServiceDescriptor>> => {
    const subservices = Object.keys(this.subservices).reduce<ServiceImpl[]>(
      (all, ssvcUuid) => {
        const ssvc = this.subservices[ssvcUuid];
        return ssvc && ssvc.parent === service ? [...all, ssvc.service] : all;
      },
      []
    );

    if (subservices.length > 0) {
      await Promise.all(
        subservices.map(async (ssvc) => ssvc.destroy && ssvc.destroy())
      );
    }

    if (service.destroy) {
      await service.destroy();
    }

    this.serviceInstances = this.serviceInstances.filter(
      (svc) => svc.uuid !== service.uuid
    );

    return this.serviceInstances.map(
      ({ uuid, serviceId = "", serviceName = "" }) => ({
        uuid,
        serviceId,
        serviceName,
      })
    );
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
        `Called next() in browser but could not find current service: ${service?.uuid} in scope:`,
        this
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
        } catch (err: any) {
          console.warn(
            `Seriously: service ${JSON.stringify(
              svc
            )} caused error: ${JSON.stringify(err.message)}`
          );
        }
      }
    }

    this.onResult(svc ? svc.uuid : null, result, requestId, null);
    return result;
  };

  rearrangeServices = (rearranged: Array<ServiceDescriptor>) => {
    this.serviceInstances = rearranged.map(
      (svc) => this.findServiceInstance(svc.uuid)[0]! // the instance must exist
    );
  };
}
