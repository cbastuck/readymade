import { AppInstance, ServiceClass } from "@/types";
import FetcherUI from "./FetcherUI";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/fetcher";
const serviceName = "Fetcher";

type State = {
  status: string | null;
};

class Fetcher extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { status: null });
  }

  async configure() {}

  async process(params: any) {
    const { url, method = "get", body, headers } = params;
    if (!url) {
      console.warn("Fetcher no url incoming", params);
      return params;
    }

    this.app.notify(this, { status: `fetch ${url}` });
    try {
      const res = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers,
      });
      this.app.notify(this, { status: null });
      const contentType = res.headers.get("content-type");
      switch (contentType) {
        case "application/json":
          return await res.json();
        case "plain/text":
          return await res.text();
        default:
          const blob = await res.blob();
          return blob;
      }
    } catch (err: any) {
      this.app.notify(this, { status: err.message });
      console.error("Fetcher caught error", err);
      return null;
    }
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
  ) => new Fetcher(app, board, descriptor, id),
  createUI: FetcherUI,
};

export default descriptor;
