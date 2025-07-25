import { ServiceUIComponent } from "hkp-frontend/src/types";
import TimerUI from "../../runtime/browser/services/TimerUI";
import MonitorUI from "../../runtime/browser/services/MonitorUI";

export function findServiceUI(serviceId: string): ServiceUIComponent | null {
  switch (serviceId) {
    case "hookup.to/service/monitor":
      return MonitorUI;
    case "hookup.to/service/timer":
      return TimerUI;
  }
  return null;
}
