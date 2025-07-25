import ejs from "ejs";
import { AppImpl, ServiceClass } from "../../../types";
import HtmlUI from "./HtmlUI";
import { parseAndEvalExpression } from "hkp-frontend/src/runtime/browser/services/base/eval";

const serviceId = "hookup.to/service/html";
const serviceName = "Html";

type EJSConfig = {
  template: string;
  locals: { [key: string]: any };
};

function isEJSConfig(obj: any): obj is EJSConfig {
  return typeof obj.template === "string" && typeof obj.locals !== "undefined";
}

class Html {
  uuid: string;
  board: string;
  app: AppImpl;

  fullscreen: boolean = false;
  config: EJSConfig | Array<any> = [];
  mode: string = "fragment-mapping";
  _html: string | undefined;

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

  prepareLocals = async (cfg: EJSConfig) => {
    return Object.keys(cfg.locals).reduce(async (all, cur) => {
      const val = cfg.locals[cur];
      if (cur.endsWith("=")) {
        return {
          ...(await all),
          [cur.slice(0, -1)]: await parseAndEvalExpression(val, {}),
        };
      }
      return Promise.resolve({ ...(await all), [cur]: val });
    }, Promise.resolve({}));
  };

  createDocument = async (params?: any) => {
    if (this.mode === "ejs" && isEJSConfig(this.config)) {
      const cfg: EJSConfig = this.config;
      try {
        const template = ejs.compile(this.config.template, {});
        const locals = await this.prepareLocals(cfg);
        return template({ ...locals, params });
      } catch (err: any) {
        return err.message;
      }
    }
    return undefined;
  };

  async configure(cfg: any) {
    const { fullscreen, config, mode } = cfg || {};

    if (fullscreen !== undefined) {
      this.fullscreen = fullscreen;
      this.app.notify(this, { fullscreen });
    }

    if (config !== undefined) {
      this.config = config;
      this._html = await this.createDocument();
      this.app.notify(this, { config, html: this._html });
    }

    if (mode !== undefined) {
      this.mode = mode;
      this._html = await this.createDocument();
      this.app.notify(this, { mode, html: this._html });
    }
  }

  async process(params: any) {
    if (this.mode === "fragment-mapping") {
      const html = `<div style="padding: 10px;"> ${
        Array.isArray(params) ? params.join("") : params
      } </div>`;
      this.app.notify(this, { html });
      return html;
    } else if (this.mode === "ejs") {
      this._html = await this.createDocument(params);
      this.app.notify(this, { html: this._html });
      return this._html;
    }
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
