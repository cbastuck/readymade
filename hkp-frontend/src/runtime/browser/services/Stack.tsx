import { v4 as uuidv4 } from "uuid";

import { filterPrivateMembers } from "./helpers";
import StackUI from "./StackUI";

const serviceId = "hookup.to/service/stack";
const serviceName = "Stack";

const defaultInput = "multiplex";
const defaultOutput = "array";

type ServiceDescriptor = {
  serviceId: string;
  serviceName: string;
  uuid?: string;
  state?: Record<string, any>;
  [key: string]: any;
};

class Stack {
  uuid: string;
  board: any;
  app: any;
  _subservices: any[];
  input: string;
  output: string;
  services?: ServiceDescriptor[];

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this._subservices = [];
    this.input = defaultInput;
    this.output = defaultOutput;
  }

  async configure(config: { services?: ServiceDescriptor[]; input?: string; output?: string; subservices?: any[] }): Promise<void> {
    const { services, input, output, subservices } = config;
    if (services !== undefined) {
      this.services = services;
      const svcWithState = subservices
        ? subservices.map((svc) => ({
            serviceId: svc.serviceId,
            serviceName: svc.serviceName,
            ...svc.state,
          }))
        : services;
      await this.createSubServices(svcWithState);
    }

    if (input !== undefined) {
      this.input = input;
      this.app.notify(this, { input });
    }

    if (output !== undefined) {
      this.output = output;
      this.app.notify(this, { output });
    }
  }

  getConfiguration = async (): Promise<any> => {
    const cfg = {
      ...filterPrivateMembers(this),
      subservices: this._subservices.map((ssvc) => filterPrivateMembers(ssvc)),
    };
    return cfg;
  };

  appendSubService = async (svc: ServiceDescriptor): Promise<void> => {
    const ssvc = await this.app.createSubService(this, svc);
    this._subservices.push(ssvc);
    this.services = this.services ? [...this.services, svc] : [svc];
    this.app.notify(this, { subservices: this._subservices });
  };

  createSubServices = async (services: ServiceDescriptor[]): Promise<void> => {
    const subservices: any[] = [];
    for (const svc of services) {
      const ssvc = await this.createSubService(svc);
      if (ssvc) {
        subservices.push(ssvc);
      }
    }
    this._subservices = subservices;
    this.app.notify(this, { subservices: this._subservices });
  };

  createSubService = async (svc: ServiceDescriptor): Promise<any> => {
    const ssvc = await this.app.createSubService(
      this,
      svc,
      svc.uuid || uuidv4()
    );

    ssvc.configure && (await ssvc.configure(svc));
    return ssvc;
  };

  removeSubservice = async (svc: any): Promise<void> => {
    this._subservices = this._subservices.filter((x) => x !== svc);
    if (svc.destroy) {
      svc.destroy();
    }
    this.app.notify(this, { subservices: this._subservices });
  };

  processSubservice = async (ssvc: any, params: any): Promise<any> => {
    if (ssvc.bypass) {
      return undefined;
    }
    return ssvc.process(params);
  };

  async processArray(params: any[]): Promise<any[] | null> {
    const results = await Promise.all(
      this._subservices.map((ssvc, idx) =>
        this.processSubservice(ssvc, params[idx])
      )
    );
    const notNull = results.some((r) => r !== null);
    return notNull ? results : null;
  }

  async processScalar(params: any, idx?: number): Promise<any> {
    if (idx !== undefined) {
      const ssvc = this._subservices[idx];
      if (ssvc) {
        return this.processSubservice(ssvc, params);
      }
    } else {
      const results: any[] = [];
      let allNull = true;
      for (const ssvc of this._subservices) {
        const r = await this.processSubservice(ssvc, params);
        if (r !== null) {
          allNull = false;
        }
        results.push(r);
      }
      return allNull ? null : results;
    }
  }

  async process(params: any): Promise<any> {
    if (this._subservices.length > 0) {
      if (this.input === "lanes") {
        if (Array.isArray(params)) {
          return this.processArray(params);
        } else {
          return this.processScalar(params, 0);
        }
      }
      const res = await this.processScalar(params);
      return res;
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) => new Stack(app, board, _descriptor, id),
  createUI: StackUI,
};

export default descriptor;
