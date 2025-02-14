import { ServiceUIComponent } from "@/types";

import MonitorUI from "../../runtime/browser/services/MonitorUI";
import AudioOutputUI from "./ui/AudioOutputUI";

export function findServiceUI(serviceId: string): ServiceUIComponent | null {
  switch (serviceId) {
    case "monitor":
      return MonitorUI;
    case "core-output":
      return AudioOutputUI;
  }
  return null;
}
