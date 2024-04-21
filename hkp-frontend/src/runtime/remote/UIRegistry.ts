import { ServiceUIComponent } from "@/types";
import TimerUI from "../../runtime/browser/services/TimerUI";

export function findServiceUI(serviceId: string): ServiceUIComponent | null {
  switch (serviceId) {
    case "hookup.to/service/timer":
      return TimerUI;
  }
  return null;
}
