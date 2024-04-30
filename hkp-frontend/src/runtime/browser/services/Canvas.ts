import { AppInstance, ServiceClass } from "@/types";
import CanvasUI from "./CanvasUI";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/canvas";
const serviceName = "Canvas";

type P = { resolve: (blob: Blob) => void; reject: (frameID: number) => void };

class Canvas extends ServiceBase<any> {
  fullscreen = false;
  clearOnRedraw = true;
  resizable = true;
  size = undefined;
  reportSizeUpdate = true;
  _frameID = 0;
  _pending: { [frameID: number]: P } = {};
  noToggleFullscreenOnDblClick = false;
  capture = false;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {});
  }

  configure(config: any) {
    const {
      fullscreen,
      clearOnRedraw,
      noToggleFullscreenOnDblClick,
      capture,
      capturedFrame,
      resizable,
      size,
      reportSizeUpdate,
    } = config || {};
    if (fullscreen !== undefined) {
      this.fullscreen = fullscreen;
    }

    if (clearOnRedraw !== undefined) {
      this.clearOnRedraw = clearOnRedraw;
    }

    if (noToggleFullscreenOnDblClick !== undefined) {
      this.noToggleFullscreenOnDblClick = noToggleFullscreenOnDblClick;
    }

    if (capture !== undefined) {
      this.capture = capture;
    }

    if (capturedFrame !== undefined) {
      this.resolveCapturedFrame(capturedFrame);
    }

    if (resizable !== undefined) {
      this.resizable = resizable;
    }

    if (size !== undefined) {
      this.size = size;
      this.app.notify(this, { size });
      if (this.reportSizeUpdate) {
        const [updatedWidth, updatedHeight] = size;
        this.app.next(this, { updatedWidth, updatedHeight });
      }
    }

    if (reportSizeUpdate !== undefined) {
      this.reportSizeUpdate = reportSizeUpdate;
    }
  }

  resolveCapturedFrame({ blob, frameID }: any) {
    const { resolve, reject } = this._pending[frameID];
    delete this._pending[frameID];
    if (this._pending[frameID + 1]) {
      reject(frameID); // next frame already scheduled
    } else {
      resolve(blob);
    }
  }

  waitForCapturedFrame(frameID: number) {
    return new Promise((resolve, reject) => {
      this._pending[frameID] = { resolve, reject };
    });
  }

  async process(params: any) {
    const frameID = this._frameID++;
    this.app.notify(this, {
      render: params,
      frameID,
      captureMime: this.capture,
    });
    if (this.capture) {
      return await this.waitForCapturedFrame(frameID).catch(
        (/*rejectFrameID*/) => null
      ); // null stops further propagation of droppped frames
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
  ) => new Canvas(app, board, descriptor, id),
  createUI: CanvasUI,
};

export default descriptor;
