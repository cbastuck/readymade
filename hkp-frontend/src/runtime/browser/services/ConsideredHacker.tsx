import HackerUI from "./HackerUI";
import Hacker from "./Hacker";

import {
  parseExpression,
  evalExpression,
} from "hkp-frontend/src/runtime/browser/services/base/eval";

const serviceId = "hookup.to/service/hacker/considered";
const serviceName = "Considered Hacker";

class ConsideredHacker extends Hacker {
  buffer: any;

  async process(params: any): Promise<any> {
    const exp = parseExpression(this.buffer);
    return evalExpression(exp, params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, descriptor: any, id: string) =>
    new ConsideredHacker(app, board, descriptor, id),
  createUI: HackerUI,
};

export default descriptor;
