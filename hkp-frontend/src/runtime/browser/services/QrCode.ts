import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import QrCodeUI from "./QrCodeUI";
import { resolveTemplateVars, getTemplateVarMap } from "hkp-frontend/src/templateVars";

const serviceId = "hookup.to/service/qr-code";
const serviceName = "QR Code";

type State = {
  url: string;
};

class QrCode extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { url: "" });
  }

  async configure(config: any) {
    if (config.url !== undefined && config.url !== this.state.url) {
      const url = resolveTemplateVars(config.url);
      this.state.url = url;
      this.app.notify(this, { url: this.state.url });
    }
  }

  async process(params: any) {
    let url =
      typeof params === "string"
        ? params
        : params?.url ?? params?.requestPath ?? "";
    if (url && url !== this.state.url) {
      url = resolveTemplateVars(url);
      if (url.includes("fromLink=")) {
        const vars = getTemplateVarMap();
        if (Object.keys(vars).length > 0) {
          url += `&vars=${btoa(JSON.stringify(vars))}`;
        }
      }
      this.state.url = url;
      this.app.notify(this, { url });
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
  ) => new QrCode(app, board, descriptor, id),
  createUI: QrCodeUI,
};

export default descriptor;
