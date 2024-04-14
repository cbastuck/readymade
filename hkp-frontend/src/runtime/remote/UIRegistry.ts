import TimerUI from "../../runtime/browser/services/TimerUI";

export default function createServiceUI(serviceId: string) {
  switch (serviceId) {
    case "hookup.to/service/timer":
      return TimerUI;
  }
}
