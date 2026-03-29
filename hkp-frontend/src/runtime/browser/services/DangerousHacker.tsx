import HackerUI from "./HackerUI";
import Hacker from "./Hacker";

import { evilEval } from "hkp-frontend/src/runtime/browser/services/base/eval";

const serviceId = "hookup.to/service/hacker/dangerous";
const serviceName = "Dangerous Hacker";

export class DangerousHacker extends Hacker {
  process(params: any): any {
    return this.baseProcess((buffer: string) => evilEval(buffer, params));
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, descriptor: any, id: string) =>
    new DangerousHacker(app, board, descriptor, id),
  createUI: HackerUI,
};

export default descriptor;
