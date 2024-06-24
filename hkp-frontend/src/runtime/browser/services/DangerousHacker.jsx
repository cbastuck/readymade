import HackerUI from "./HackerUI";
import Hacker from "./Hacker";

import { evilEval } from "hkp-services/eval";

const serviceId = "hookup.to/service/hacker/dangerous";
const serviceName = "Dangerous Hacker";

export class DangerousHacker extends Hacker {
  process(params) {
    return this.baseProcess((buffer) => evilEval(buffer, params));
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new DangerousHacker(app, board, descriptor, id),
  createUI: HackerUI,
};

export default descriptor;
