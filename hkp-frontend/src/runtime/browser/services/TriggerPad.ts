import { AppInstance, ServiceClass } from "@/types";
import TriggerPadUI from "./TriggerPadUI";

const serviceId = "hookup.to/service/trigger-pad";
const serviceName = "Trigger Pad";

class TriggerPad {
  uuid: string;
  board: string;
  app: AppInstance;

  armedPad: number = 0;
  padAssignments: { [key: string]: any } = {};

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  destroy() {}

  configure(config: any) {
    const { padAssignments, armedPad } = config;

    const notification: any = {};
    if (padAssignments !== undefined) {
      this.padAssignments = notification.assignments = padAssignments;
    }

    if (armedPad !== undefined) {
      this.armedPad = notification.armedPad = armedPad;
    }

    this.app.notify(this, notification);
  }

  padAssignment(padIndex: number) {
    return this.padAssignments[padIndex];
  }

  triggerPad(padIndex: number) {
    const assignment = this.padAssignment(padIndex);
    if (assignment) {
      return this.app.next(this, assignment);
    } else {
      this.armedPad = padIndex;
    }
  }

  clearPad(padIndex: number) {
    const idx = `${padIndex}`;
    this.padAssignments[idx] = undefined;
    this.armedPad = padIndex;
    this.app.notify(this, {
      assignments: this.padAssignments,
      armedPad: this.armedPad,
    });
  }

  isMatch(params: any) {
    const isBlob = params instanceof Blob;
    const isObject = typeof params === "object" && params !== null;
    return isBlob || isObject;
  }

  async process(params: any) {
    if (this.isMatch(params)) {
      if (this.armedPad !== undefined) {
        const idx = `${this.armedPad}`;
        this.padAssignments[idx] = params;
        this.app.notify(this, { assignments: this.padAssignments });
        for (; this.padAssignments[this.armedPad]; ) {
          ++this.armedPad;
        }
        this.app.notify(this, { armedPad: this.armedPad });
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
