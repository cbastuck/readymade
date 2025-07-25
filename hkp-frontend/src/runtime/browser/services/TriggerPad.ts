import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import TriggerPadUI from "./TriggerPadUI";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/trigger-pad";
const serviceName = "Trigger Pad";

type State = {
  armedPad: number;
  padAssignments: { [key: string]: any };
};

class TriggerPad extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      armedPad: 0,
      padAssignments: {},
    });
  }

  destroy() {}

  configure(config: any) {
    const { padAssignments, armedPad } = config;

    const notification: any = {};
    if (padAssignments !== undefined) {
      this.state.padAssignments = notification.assignments = padAssignments;
    }

    if (armedPad !== undefined) {
      this.state.armedPad = notification.armedPad = armedPad;
    }

    if (config.command) {
      if (config.command.action === "trigger-pad") {
        this.triggerPad(config.command.params.padIndex);
      } else if (config.command.action === "clear-pad") {
        this.clearPad(config.command.params.padIndex);
      }
    }

    this.app.notify(this, notification);
  }

  padAssignment(padIndex: number) {
    return this.state.padAssignments[padIndex];
  }

  triggerPad(padIndex: number) {
    const assignment = this.padAssignment(padIndex);
    if (assignment) {
      this.app.next(this, assignment);
    } else {
      this.state.armedPad = padIndex;
    }
  }

  clearPad(padIndex: number) {
    const idx = `${padIndex}`;
    this.state.padAssignments[idx] = undefined;
    this.state.armedPad = padIndex;
    this.app.notify(this, {
      assignments: this.state.padAssignments,
      armedPad: this.state.armedPad,
    });
  }

  isMatch(params: any) {
    const isBlob = params instanceof Blob;
    const isObject = typeof params === "object" && params !== null;
    return isBlob || isObject;
  }

  async process(params: any) {
    if (this.isMatch(params)) {
      if (this.state.armedPad !== undefined) {
        const idx = `${this.state.armedPad}`;
        this.state.padAssignments[idx] = params;
        this.app.notify(this, { assignments: this.state.padAssignments });
        for (; this.state.padAssignments[this.state.armedPad]; ) {
          ++this.state.armedPad;
        }
        this.app.notify(this, { armedPad: this.state.armedPad });
      }
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new TriggerPad(app, board, descriptor, id),
  createUI: TriggerPadUI,
};

export default descriptor;
