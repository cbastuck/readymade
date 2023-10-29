import { TimerUI } from "../../runtime/browser/services/Timer";

export default function createServiceUI(serviceId: string) {
  switch (serviceId) {
    case "hookup.to/service/timer":
      return TimerUI;
  }
}
