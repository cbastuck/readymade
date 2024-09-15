import { v4 as uuidv4 } from "uuid";

import { filterPrivateMembers } from "./helpers";
import StackUI from "./StackUI";
import {
  AppInstance,
  ServiceClass,
  ServiceDescriptor,
  ServiceInstance,
} from "@/types";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/looper";
const serviceName = "Looper";

type State = {
  services: Array<ServiceDescriptor>;
  numIterations: number;
  iterationResults: Array<any>;
};

class Stack extends ServiceBase<State> {
  _instances: Array<ServiceInstance> = [];

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, _descriptor, id, {
      services: [],
      numIterations: 1,
      iterationResults: [],
    });
  }

  async configure(config: any) {
    const { services, numIterations, command } = config;
    if (services !== undefined) {
      this.state.services = services;
      await this.restoreInstances(this.state.services);
      this.app.notify(this, { instances: this._instances });
    }

    if (numIterations !== undefined) {
      this.state.numIterations = numIterations;
      this.app.notify(this, { numIterations: this.state.numIterations });
    }

    if (command !== undefined) {
      if (command.action === "loop") {
        this.doLoop();
      }
    }
  }

  getConfiguration = async () => {
    return {
      bypass: this.bypass,
      services: this._instances.map((ssvc) => filterPrivateMembers(ssvc)),
      numIterations: this.state.numIterations,
      iterationResults: this.state.iterationResults,
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
    const instances = [];
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
      ssvc.configure && (await ssvc.configure((svc as any).state || svc)); // TODO: we're missing a type for the Service Descriptor with state?
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
    this.app.next(this, r);
  }

  async processInternal(params: any) {
    let result = params;
    for (let i = 0; i < this.state.numIterations; ++i) {
      result = await this.processBody(result);
      this.state.iterationResults.push(result);
      this.app.notify(this, {
        iterationResults: this.state.iterationResults.slice(),
      });
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
