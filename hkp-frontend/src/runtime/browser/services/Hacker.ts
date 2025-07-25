import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { Size } from "hkp-frontend/src/common";

export type HealthStatus = {
  error: boolean;
  message?: string;
};

type State = { buffer: string; healthStatus: HealthStatus; size?: Size };

export default class Hacker extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      buffer: "",
      healthStatus: {
        error: false,
      },
    });
    this.resetHealthStatus(false);
  }

  resetHealthStatus = (notify = false) => {
    this.state.healthStatus = {
      error: false,
    };
    if (notify) {
      this.app.notify(this, { healthStatus: this.state.healthStatus });
    }
  };

  baseProcess = async (impl: (param: any) => Promise<any>) => {
    const prevHealth = this.state.healthStatus;
    let res;
    try {
      res = await impl(this.state.buffer);
      this.state.healthStatus = { error: false };
    } catch (err) {
      this.onError(err as Error, !prevHealth.error);
    }
    return this.state.healthStatus.error ? null : res;
  };

  onError = (err: Error, notify: boolean) => {
    this.state.healthStatus = {
      error: true,
      message: err.message,
    };
    if (notify) {
      this.app.notify(this, { healthStatus: this.state.healthStatus });
    }
  };

  configure = async (config: any) => {
    const { buffer, size } = config;
    if (buffer !== undefined) {
      this.state.buffer = buffer;
      if (this.state.healthStatus.error) {
        this.resetHealthStatus(true);
      }
      this.app.notify(this, { buffer });
    }

    if (size !== undefined) {
      this.state.size = size;
    }
  };
}
