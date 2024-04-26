import CanvasUI from "./CanvasUI";

const serviceId = "hookup.to/service/canvas";
const serviceName = "Canvas";

const TWO_PI = 2 * Math.PI;

class Canvas {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.fullscreen = false;
    this.clearOnRedraw = true;
    this._frameID = 0;
    this._pending = {};
    this.resizable = true;
    this.size = undefined;
    this.reportSizeUpdate = true;
  }

  configure(config) {
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

  resolveCapturedFrame({ blob, frameID }) {
    const { resolve, reject } = this._pending[frameID];
    delete this._pending[frameID];
    if (this._pending[frameID + 1]) {
      reject(frameID); // next frame already scheduled
    } else {
      resolve(blob);
    }
  }

  waitForCapturedFrame(frameID) {
    return new Promise((resolve, reject) => {
      this._pending[frameID] = { resolve, reject };
    });
  }

  async process(params) {
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
  create: (app, board, descriptor, id) =>
    new Canvas(app, board, descriptor, id),
  createUI: CanvasUI,
};

export default descriptor;
