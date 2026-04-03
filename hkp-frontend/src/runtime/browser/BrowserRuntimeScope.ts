import {
  AppImpl,
  InstanceId,
  ProcessContext,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
  User,
} from "../../types";
import BrowserRegistry from "./BrowserRegistry";
import { createBrowserRuntimeApp } from "./BrowserRuntimeApp";
import api from "./BrowserRuntimeApi";
import { onServiceProcess, onServiceResult } from "../serviceState";

export type InstanceIndexTuple = [ServiceInstance | null, number];

export default class BrowserRuntimeScope implements RuntimeScope {
  descriptor: RuntimeDescriptor;
  serviceInstances: Array<ServiceInstance>;
  subservices: {
    [uuid: string]: { service: ServiceInstance; parent: ServiceInstance };
  };
  app: AppImpl;
  registry: BrowserRegistry;
  authenticatedUser: User | null = null;
  state: { [key: string]: any } = {};

  constructor(runtime: RuntimeDescriptor, registry: BrowserRegistry) {
    this.descriptor = runtime;
    this.registry = registry;
    this.serviceInstances = [];
    this.subservices = {};
    this.app = createBrowserRuntimeApp(this);
  }

  getApi(): RuntimeApi {
    return api;
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    _instanceId: string | null,
    _result: any,
    _context?: ProcessContext | null,
  ): Promise<void> => {
    console.warn("BrowserRuntimeScope.onResult not set");
  };

  onAction = (_action: ServiceAction) => {
    console.warn("BrowserRuntimeScope.onAction not implemented");
    return false;
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

  appendService = (svc: ServiceInstance) => {
    this.serviceInstances.push(svc);
  };

  removeService = async (
    service: ServiceInstance,
  ): Promise<Array<ServiceDescriptor>> => {
    const subserviceIds = Object.keys(this.subservices).filter((ssvcUuid) => {
      const ssvc = this.subservices[ssvcUuid];
      return !!ssvc && ssvc.parent === service;
    });

    const subservices = subserviceIds.reduce<ServiceInstance[]>(
      (all, ssvcUuid) => {
        const ssvc = this.subservices[ssvcUuid];
        return ssvc && ssvc.parent === service ? [...all, ssvc.service] : all;
      },
      [],
    );

    if (subservices.length > 0) {
      await Promise.all(
        subservices.map(async (ssvc) => ssvc.destroy && ssvc.destroy()),
      );
      for (const ssvcUuid of subserviceIds) {
        delete this.subservices[ssvcUuid];
      }
    }

    if (service.destroy) {
      await service.destroy();
    }

    this.serviceInstances = this.serviceInstances.filter(
      (svc) => svc.uuid !== service.uuid,
    );

    return this.serviceInstances.map(
      ({ uuid, serviceId = "", serviceName = "" }) => ({
        uuid,
        serviceId,
        serviceName,
      }),
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

  getSubservice = (ssvcUuid: string): ServiceInstance | null => {
    const m = this.subservices[ssvcUuid];
    return m ? m.service : null;
  };

  // service parameter can be null, then starts with the first service
  next = async (
    service: InstanceId | null,
    params: any,
    context?: ProcessContext | null,
    advanceBeforeProcess: boolean = true,
  ) => {
    const services = this.serviceInstances;
    const [svc_, position] = this.findServiceInstance(service?.uuid || null);
    if (position === -1) {
      return console.error(
        `Called next() in browser but could not find current service: ${service?.uuid} in scope:`,
        this,
      );
    }
    let svc = svc_;

    let result = params;
    for (
      let i = advanceBeforeProcess ? position + 1 : position;
      !!services[i] && result !== null;
      ++i
    ) {
      svc = services[i];
      if (svc && !svc.bypass) {
        try {
          onServiceProcess(this.app, svc, params);
          result = await svc.process(params);
          onServiceResult(this.app, svc, result);
          params = result;
        } catch (err: any) {
          console.warn(
            `Seriously: service ${
              svc.serviceName
            } caused error: ${JSON.stringify(err.message)}`,
          );
        }
      }
    }

    this.onResult(svc ? svc.uuid : null, result, context);
    return result;
  };

  rearrangeServices = (rearranged: Array<ServiceDescriptor>) => {
    this.serviceInstances = rearranged.map(
      (svc) => this.findServiceInstance(svc.uuid)[0]!, // the instance must exist
    );
  };

  processRuntimeByName = async (_name: string, _params: any) => {
    console.warn("processRuntimeByName not implemented");
  };

  serializeState = () => {
    return this.state;
  };

  setState = (partialUpdate: { [key: string]: any }) => {
    this.state = { ...this.state, ...partialUpdate };
  };
}
