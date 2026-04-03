import { ServiceClass, ServiceUIComponent } from "hkp-frontend/src/types";

import MonitorUI from "../../runtime/browser/services/MonitorUI";
import CoreOutputUI from "./ui/CoreOutputUI";
import CoreInputUI from "./ui/CoreInputUI";
import FilterUI from "./ui/FilterUI";
import MapUIV0 from "./ui/MapUI";
import MapUIV1 from "../../runtime/browser/services/MapUI";
import HttpClientUI from "./ui/HttpClientUI";

type ServiceLookup = {
  serviceId?: ServiceClass["serviceId"];
  version?: ServiceClass["version"];
  capabilities?: ServiceClass["capabilities"];
};

export function hasCapability(
  capabilities: ServiceClass["capabilities"] | undefined,
  capability: string,
): boolean {
  if (!capabilities?.length) {
    return false;
  }
  const target = capability.trim().toLocaleLowerCase();
  return capabilities.some((cap) => cap.trim().toLocaleLowerCase() === target);
}

function findServiceUIByKey(
  key: string,
  _capabilities?: ServiceClass["capabilities"],
): ServiceUIComponent | null {
  switch (key.toLocaleLowerCase()) {
    case "monitor":
      return MonitorUI;
    case "core-output":
      return CoreOutputUI;
    case "core-input":
      return CoreInputUI;
    case "filter":
      return FilterUI;
    case "map":
      return MapUIV0;
    case "map@v1":
      return MapUIV1;
    case "http-client":
      return HttpClientUI;
  }
  return null;
}

export function findServiceUI(
  service: string | ServiceLookup,
): ServiceUIComponent | null {
  const descriptor: ServiceLookup =
    typeof service === "string" ? { serviceId: service } : service;

  const serviceId = descriptor.serviceId?.trim();
  if (!serviceId) {
    return null;
  }

  const version = descriptor.version?.trim();
  if (version) {
    const ui = findServiceUIByKey(
      `${serviceId}@${version}`,
      descriptor.capabilities,
    );
    if (ui) {
      return ui;
    }
  }

  return findServiceUIByKey(serviceId, descriptor.capabilities);
}
