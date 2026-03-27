import { v4 as uuidv4 } from "uuid";

import { filterPrivateMembers } from "./helpers";
import StackUI from "./StackUI";
import {
  AppInstance,
  ServiceClass,
  ServiceDescriptor,
  ServiceImpl,
  ServiceInstance,
} from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import { parseExpression, Expression, evalExpression } from "./base/eval";

const serviceId = "hookup.to/service/looper";
const serviceName = "Looper";

type State = {
  services: Array<ServiceDescriptor>;
  iterationResults: Array<any>;
  interactiveMode: boolean;
  incrementalOutput: boolean;
  loopCondition: string;
};

class Stack extends ServiceBase<State> {
  _instances: Array<ServiceInstance> = [];
  _loopExpression: Expression | null = null;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, _descriptor, id, {
      services: [],
      iterationResults: [],
      interactiveMode: false,
      incrementalOutput: false,
      loopCondition: "",
    });
  }

  async configure(config: any) {
    const {
      services,
      command,
      incrementalOutput,
      interactiveMode,
      loopCondition,
    } = config;
    if (services !== undefined) {
      this.state.services = services;
      await this.restoreInstances(this.state.services);
      this.app.notify(this, { instances: this._instances });
    }

    if (command !== undefined) {
      if (command.action === "loop") {
        this.doLoop();
      }
    }

    if (needsUpdate(incrementalOutput, this.state.incrementalOutput)) {
      this.state.incrementalOutput = incrementalOutput;
      this.app.notify(this, {
        incrementalOutput: this.state.incrementalOutput,
      });
    }

    if (needsUpdate(interactiveMode, this.state.interactiveMode)) {
      this.state.interactiveMode = interactiveMode;
      this.app.notify(this, { interactiveMode: this.state.interactiveMode });
    }

    if (needsUpdate(loopCondition, this.state.loopCondition)) {
      this.state.loopCondition = loopCondition;
      const exp = parseExpression(this.state.loopCondition);
      if (exp !== "syntax-error") {
        this._loopExpression = exp;
      }

      this.app.notify(this, { loopCondition: this.state.loopCondition });
    }
  }

  getConfiguration = async () => {
    return {
      ...this.state,
      bypass: this.bypass,
      services: this._instances.map((ssvc) => filterPrivateMembers(ssvc)),
    };
  };

  appendSubService = async (s: ServiceClass) => {
    const svc = await this.createSubService(s);
    if (svc) {
      this._instances.push(svc);
      this.state.services = [...this.state.services, { ...s, uuid: svc.uuid }];
      this.app.notify(this, { instances: this._instances });
    }
  };

  restoreInstances = async (services: Array<ServiceDescriptor>) => {
    const instances: Array<ServiceImpl> = [];
    for (const svc of services) {
      const ssvc = await this.createSubService(svc);
      if (ssvc) {
        instances.push(ssvc);
      }
    }
    this._instances = instances;
    this.state.services = services;
  };

  createSubService = async (svc: ServiceClass | ServiceDescriptor) => {
    const ssvc = await this.app.createSubService(
      this,
      svc,
      (svc as any).uuid || uuidv4()
    );

    if (ssvc) {
      await ssvc.configure((svc as any).state || svc); // TODO: we're missing a type for the Service Descriptor with state?
    }

    return ssvc;
  };

  removeSubservice = async (svc: ServiceInstance) => {
    this._instances = this._instances.filter((x) => x !== svc);
    this.state.services = this.state.services.filter(
      (x) => x.uuid !== svc.uuid
    );
    if (svc.destroy) {
      svc.destroy();
    }
    this.app.notify(this, { instances: this._instances });
  };

  processSubservice = async (ssvc: ServiceInstance, params: any) => {
    if (ssvc.bypass) {
      return undefined;
    }
    return ssvc.process(params);
  };

  processBody = async (params: any) => {
    let result = params;
    for (const ssvc of this._instances) {
      result = await this.processSubservice(ssvc, result);
    }
    return result;
  };

  async doLoop() {
    const recentResult =
      this.state.iterationResults[this.state.iterationResults.length - 1];
    const r = await this.processInternal(recentResult);
    if (this.state.incrementalOutput) {
      this.app.next(this, r);
    }
  }

  shouldLoop = async (iteration: number, params: any) => {
    if (this.state.interactiveMode) {
      return iteration === 0; // in interactive mode the first iteration is always executed
    }

    if (!this.state.loopCondition) {
      return false;
    }

    if (this._loopExpression === null) {
      throw new Error("Invalid loop expression");
    }

    const p = { params, iteration, i: iteration };
    return await evalExpression(this._loopExpression, p, this.app);
  };

  async processInternal(params: any) {
    let result = params;
    for (let i = 0; await this.shouldLoop(i, params); ++i) {
      result = await this.processBody(result);
      this.state.iterationResults.push(result);
      this.app.notify(this, {
        iterationResults: this.state.iterationResults.slice(),
      });
      if (this.state.incrementalOutput) {
        this.app.next(this, result);
      }
    }
    return result;
  }

  process(params: any) {
    this.state.iterationResults = [];
    return this.processInternal(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) => new Stack(app, board, descriptor, id),
  createUI: StackUI,
};

export default descriptor;
