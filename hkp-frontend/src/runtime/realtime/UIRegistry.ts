import { ServiceUIComponent } from "hkp-frontend/src/types";

import MonitorUI from "../../runtime/browser/services/MonitorUI";
import CoreOutputUI from "./ui/CoreOutputUI";
import CoreInputUI from "./ui/CoreInputUI";
import FilterUI from "./ui/FilterUI";
import MapUI from "./ui/MapUI";
import HttpClientUI from "./ui/HttpClientUI";

export function findServiceUI(serviceId: string): ServiceUIComponent | null {
  switch (serviceId.toLocaleLowerCase()) {
    case "monitor":
      return MonitorUI;
    case "core-output":
      return CoreOutputUI;
    case "core-input":
      return CoreInputUI;
    case "filter":
      return FilterUI;
    case "map":
      return MapUI;
    case "http-client":
      return HttpClientUI;
  }
  return null;
}
