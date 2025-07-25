import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import FetcherUI from "./FetcherUI";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import { parseAndEvalExpression } from "./base/eval";

const serviceId = "hookup.to/service/fetcher";
const serviceName = "Fetcher";

export type BodyFormat = "json" | "text";

type State = {
  status: string | null;
  url: string | null;
  method: string;
  headers: { [name: string]: string };
  body: string | null;
  bodyFormat: BodyFormat;
};

class Fetcher extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      url: null,
      status: null,
      method: "GET",
      headers: {},
      body: null,
      bodyFormat: "text",
    });
  }

  async configure(config: any) {
    if (needsUpdate(config.url, this.state.url)) {
      this.state.url = config.url;
      this.app.notify(this, { url: this.state.url });
    }

    if (needsUpdate(config.method, this.state.method)) {
      this.state.method = config.method;
      this.app.notify(this, { method: this.state.method });
    }

    if (needsUpdate(config.headers, this.state.headers)) {
      this.state.headers = config.headers;
      this.app.notify(this, { headers: this.state.headers });
    }

    if (needsUpdate(config.bodyFormat, this.state.bodyFormat)) {
      this.state.bodyFormat = config.bodyFormat;
      this.app.notify(this, { bodyFormat: this.state.bodyFormat });
    }

    if (needsUpdate(config.body, this.state.body)) {
      this.state.body = config.body;
      this.app.notify(this, { body: this.state.body });
    }

    if (config.command) {
      if (config.command.action === "fetch") {
        const result = await this.process(config.command?.params);
        this.app.next(this, result);
      }
    }
  }

  getStateBody = () => {
    if (!this.state.body) {
      return null;
    }
    return this.state.bodyFormat === "json"
      ? JSON.parse(this.state.body)
      : this.state.body;
  };

  getBody = (params: any) => {
    const stateBody = this.getStateBody();
    if (stateBody) {
      if (typeof params === "object") {
        return { ...stateBody, ...params };
      }
      return stateBody;
    }
    return params;
  };

  async process(params: any) {
    const { config: { serviceId = "", data = null } = {} } = params || {};
    const {
      url: paramsUrl = "",
      method: paramsMethod = "",
      headers: paramsHeaders = "",
      body: paramsBody = null,
    } = serviceId === "hookup.to/service/fetcher" ? data : {};

    const url = this.state.url || paramsUrl;
    if (!url) {
      console.warn("Fetcher no url incoming", params);
      return params;
    }

    const payload = this.getBody(paramsBody);

    const substitutedUrl = data?.variables
      ? substituteUrl(url, data.variables)
      : url;

    const method = paramsMethod || this.state.method;
    const headers = paramsHeaders || this.state.headers;
    const processedHeaders = await Object.keys(headers).reduce(
      async (acc, key) => {
        const resolvedAcc = await acc;
        if (key.endsWith("=")) {
          const value = headers[key];
          const processed = await parseAndEvalExpression(value, {}, this.app);
          return Promise.resolve({
            ...resolvedAcc,
            [key.slice(0, -1)]: processed,
          });
        } else {
          return Promise.resolve({ ...resolvedAcc, [key]: headers[key] });
        }
      },
      Promise.resolve({})
    );

    this.app.notify(this, { status: `fetch ${substitutedUrl}` });
    const body = payload
      ? typeof payload === "string"
        ? payload
        : JSON.stringify(payload)
      : undefined;
    try {
      const res = await fetch(substitutedUrl, {
        method,
        body,
        headers: processedHeaders,
      });
      this.app.notify(this, { status: null });
      const contentType = res.headers.get("content-type");

      if (contentType?.startsWith("application/json")) {
        return await res.json();
      } else if (contentType?.startsWith("text/text")) {
        return await res.text();
      } else {
        return await res.blob();
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
