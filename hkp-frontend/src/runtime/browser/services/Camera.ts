import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import CameraUI from "./CameraUI";

const serviceId = "hookup.to/service/camera";
const serviceName = "Camera";

type Screenshooter = () => Promise<Blob | null>;
type State = {
  captureAs: string;
  captureFormat: string;
};
class Camera extends ServiceBase<State> {
  _shooter: null | Screenshooter = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      captureAs: "image",
      captureFormat: "image/png",
    });
  }

  async configure(config: any) {
    const { captureAs, captureFormat, action } = config;
    if (captureAs !== undefined) {
      this.state.captureAs = captureAs;
      this.app.notify(this, { captureAs });
    }

    if (captureFormat !== undefined) {
      this.state.captureFormat = captureFormat;
      this.app.notify(this, { captureFormat });
    }

    if (action == "triggerSnapshot") {
      const screenshot = await this.process({});
      this.app.next(this, screenshot);
    }
  }

  inject(blob: Blob) {
    setImmediate(() => this.app.next(this, blob));
  }

  registerScreenshooter(shooter: Screenshooter) {
    this._shooter = shooter;
  }

  async process(params: any) {
    if (this._shooter) {
      const image = await this._shooter();
      return this.state.captureAs
        ? {
            ...(params || {}),
            [this.state.captureAs]: image,
          }
        : image;
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
  ) => new Camera(app, board, descriptor, id),
  createUI: CameraUI,
};

export default descriptor;
