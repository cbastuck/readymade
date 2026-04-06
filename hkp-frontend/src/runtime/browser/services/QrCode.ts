import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import QrCodeUI from "./QrCodeUI";

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
      let url: string = config.url;
      if (url.includes("MEANDER_HOST")) {
        try {
          const info = await fetch("hkp://meander/info").then((r) => r.json());
          if (info?.lanIp) {
            url = url.replace(/MEANDER_HOST/g, info.lanIp);
          }
        } catch (e) {
          console.warn("QrCode: could not resolve MEANDER_HOST via hkp://meander/info", e);
        }
      }
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
      if (url.includes("MEANDER_HOST")) {
        try {
          const info = await fetch("hkp://meander/info").then((r) => r.json());
          if (info?.lanIp) {
            url = url.replace(/MEANDER_HOST/g, info.lanIp);
          }
        } catch (e) {
          console.warn(
            "QrCode: could not resolve MEANDER_HOST via hkp://meander/info",
            e,
          );
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
