import * as uuid from "uuid";
import UAParser from "ua-parser-js";
import {
  AddRuntimeResult,
  AddServiceResult,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceClass,
  ServiceDescriptor,
} from "../types";

export const BrowserRuntimeApi: RuntimeApi = {
  onRestoreRuntime: async (
    rt: RuntimeDescriptor,
    services: Array<ServiceDescriptor>
  ) => {
    return { runtime: rt, services };
  },
  addRuntime: (rtClass: RuntimeClass): AddRuntimeResult => {
    const { name: passedName, type, url } = rtClass;
    const runtimeId = uuid.v4();
    const browser = new UAParser().getBrowser();
    const rt: RuntimeDescriptor = {
      id: runtimeId,
      name: browser.name || passedName,
      type,
      url,
    };
    return Promise.resolve({ runtime: rt, services: [] });
  },
  addService: (
    runtime: RuntimeDescriptor,
    service: ServiceClass
  ): AddServiceResult => {
    return {
      ...service,
      uuid: uuid.v4(),
    };
  },
};
