import { AppImpl, ServiceClass } from "../../../types";
import HtmlUI from "./HtmlUI";

const serviceId = "hookup.to/service/html";
const serviceName = "Html";

class Html {
  uuid: string;
  board: string;
  app: AppImpl;

  fullscreen: boolean = false;
  config = [];

  constructor(
    app: AppImpl,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.fullscreen = false;
  }

  async destroy() {}

  async configure(cfg: any) {
    const { fullscreen, config } = cfg || {};

    if (fullscreen !== undefined) {
      this.fullscreen = fullscreen;
      this.app.notify(this, { fullscreen });
    }

    if (config !== undefined) {
      this.config = config;
      this.app.notify(this, { config });
    }
  }

  async process(params: any) {
    const html = `
      <div style="padding: 10px;">
        ${Array.isArray(params) ? params.join("") : params}
      </div>`;
    this.app.notify(this, { html });
    return html;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new Html(app, board, descriptor, id),
  createUI: HtmlUI,
};

export default descriptor;
