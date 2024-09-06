import { AppInstance, ServiceClass } from "@/types";
import FetcherUI from "./FetcherUI";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "@/ui-components/service/ServiceUI";

const serviceId = "hookup.to/service/fetcher";
const serviceName = "Fetcher";

type State = {
  status: string | null;
  url?: string;
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

  async configure(config: any) {
    if (needsUpdate(config.url, this.state.url)) {
      this.state.url = config.url;
      this.app.notify(this, { url: this.state.url });
    }

    if (config.command) {
      if (config.command.action === "fetch") {
        const result = await this.process(config);
        this.app.next(this, result);
      }
    }
  }

  async process(params: any) {
    const {
      url = this.state.url,
      method = "get",
      body,
      headers,
      variables,
    } = params;
    if (!url) {
      console.warn("Fetcher no url incoming", params);
      return params;
    }

    const substitutedUrl = variables ? substituteUrl(url, variables) : url;
    this.app.notify(this, { status: `fetch ${substitutedUrl}` });
    try {
      const res = await fetch(substitutedUrl, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers,
      });
      this.app.notify(this, { status: null });
      const contentType = res.headers.get("content-type");

      if (contentType?.startsWith("application/json")) {
        return await res.json();
      } else if (contentType?.startsWith("text/text")) {
        return await res.text();
      } else {
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

function substituteUrl(
  url: string,
  variables: { [variable: string]: string }
): string {
  let substitutedUrl = url;
  for (const [key, value] of Object.entries(variables)) {
    substitutedUrl = substitutedUrl.replace(`%${key}%`, value);
  }
  return substitutedUrl;
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
