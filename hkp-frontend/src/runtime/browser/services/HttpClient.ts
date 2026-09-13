import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import HttpClientUI from "./HttpClientUI";
import {
  MOUNT_FIELD,
  parseMountRef,
} from "hkp-frontend/src/runtime/board/mount";
import { resolveCredential } from "hkp-frontend/src/core/secrets";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import { HttpMethod, METHODS } from "./http-client-methods";

/**
 * Service Documentation
 * Service ID: http-client
 * Service Name: HTTP Client
 * Runtime: browser
 * Modes: none (method is configuration, not a mode)
 * Key Config: url, __hkpMount (target), path, query, method, headers,
 *             userAgent, body, timeoutMs
 * IO: in=body to send (string | object | bytes | {meta, body|binary})
 *     out=null immediately; the response is pushed through the rest of the
 *     pipeline when it arrives, shaped {meta, body?, binary?}
 *
 * The browser implementation of the `http-client` concept hkp-node, hkp-python
 * and hkp-rt also provide, sharing their state contract and their response
 * shape, so a board can move a request between runtimes by moving the service.
 *
 * What differs is not the contract but what the runtime around it can do. A
 * request made here is made by the page: the browser decides which cross-origin
 * calls are allowed, adds the headers it reserves for itself, and shows the
 * request to anything running in the page. That is the trade the board author
 * makes — an API that answers with permissive CORS headers needs no runtime at
 * all, while one that does not, or one reached with a credential, wants the
 * request made somewhere the page cannot see.
 *
 * Two consequences worth knowing when a board is written against this service
 * rather than the Node one:
 *
 *   A blocked call fails as a bare network error. The browser does not tell the
 *   page why, so `error` says what `fetch` said and no more.
 *
 *   `meta.headers` carries only what the response exposes. Same-origin, that is
 *   everything; cross-origin, it is the CORS-safelisted headers plus whatever
 *   the server named in `Access-Control-Expose-Headers`.
 *
 * Like the remote implementations it can call a mount: `url` may hold a
 * `hkp-mount://<runtimeId>/<serviceUuid>` reference instead of an address,
 * naming the service that owns the endpoint. The board's coordinator resolves
 * it and configures `__hkpMount` with the address, which then takes precedence
 * — `url` stays what a person wrote, `__hkpMount` what the run produced, and
 * neither overwrites the other.
 */

const serviceId = "http-client";
const serviceName = "HTTP Client";

type State = {
  url: string;
  // Reserved name: the board's coordinator reads and rewrites it. Holds the
  // address to call, or a reference to the service that owns it while
  // unresolved.
  __hkpMount: string;
  path: string;
  query: Record<string, string>;
  method: HttpMethod;
  headers: Record<string, string>;
  userAgent: string;
  body: string;
  timeoutMs: number;
};

type RequestBody = { body: BodyInit | Uint8Array; contentType?: string } | null;

/** Content type with any parameters (`; charset=…`) stripped, lower-cased. */
function mediaType(contentType: string | null | undefined): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

/** Whether a response of this type is worth decoding rather than kept as bytes. */
function isTextual(type: string): boolean {
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type.endsWith("+json") ||
    type === "application/x-www-form-urlencoded"
  );
}

/** Headers as a plain record, lower-cased as HTTP names compare. */
function headerRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

class HttpClient extends ServiceBase<State> {
  private inFlight = 0;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      url: "",
      __hkpMount: "",
      path: "",
      query: {},
      method: "get",
      headers: {},
      userAgent: "",
      body: "",
      timeoutMs: 10000,
    });
  }

  configure(config: any): void {
    if (typeof config.url === "string" && needsUpdate(config.url, this.state.url)) {
      this.state.url = config.url;
      this.app.notify(this, { url: this.state.url });
    }

    const mount = config[MOUNT_FIELD];
    if (typeof mount === "string" && needsUpdate(mount, this.state.__hkpMount)) {
      this.state.__hkpMount = mount;
      this.app.notify(this, { [MOUNT_FIELD]: this.state.__hkpMount });
    }

    if (typeof config.path === "string" && needsUpdate(config.path, this.state.path)) {
      this.state.path = config.path;
      this.app.notify(this, { path: this.state.path });
    }

    if (config.query && typeof config.query === "object" && !Array.isArray(config.query)) {
      const query = asStrings(config.query);
      if (needsUpdate(query, this.state.query)) {
        this.state.query = query;
        this.app.notify(this, { query: this.state.query });
      }
    }

    if (
      typeof config.method === "string" &&
      METHODS.includes(config.method.toLowerCase() as HttpMethod)
    ) {
      const method = config.method.toLowerCase() as HttpMethod;
      if (needsUpdate(method, this.state.method)) {
        this.state.method = method;
        this.app.notify(this, { method: this.state.method });
      }
    }

    if (config.headers && typeof config.headers === "object") {
      const headers = asStrings(config.headers);
      if (needsUpdate(headers, this.state.headers)) {
        this.state.headers = headers;
        this.app.notify(this, { headers: this.state.headers });
      }
    }

    if (
      typeof config.userAgent === "string" &&
      needsUpdate(config.userAgent, this.state.userAgent)
    ) {
      this.state.userAgent = config.userAgent;
      this.app.notify(this, { userAgent: this.state.userAgent });
    }

    if (typeof config.body === "string" && needsUpdate(config.body, this.state.body)) {
      this.state.body = config.body;
      this.app.notify(this, { body: this.state.body });
    }

    if (
      typeof config.timeoutMs === "number" &&
      config.timeoutMs > 0 &&
      needsUpdate(config.timeoutMs, this.state.timeoutMs)
    ) {
      this.state.timeoutMs = config.timeoutMs;
      this.app.notify(this, { timeoutMs: this.state.timeoutMs });
    }
  }

  /**
   * Starts the request and stops the push.
   *
   * The response cannot be returned from here — it does not exist yet, and the
   * services after this one would be called with a promise. Returning null
   * stops the push, and the rest of the pipeline is called with the response
   * once it arrives (the inversion-of-control path a cache or a fetching
   * service takes).
   */
  process(input: any): any {
    const target = this.targetUrl();
    if (!target) {
      // Either nothing is configured, or the mount's owner has not published an
      // address yet. Say so and stop; the next input tries again, by which time
      // the coordinator has usually handed the address over.
      const pending = [this.state.__hkpMount, this.state.url].find((value) =>
        parseMountRef(value),
      );
      this.app.notify(this, {
        error: pending
          ? `Waiting for "${pending}" to publish an endpoint`
          : "No target configured",
      });
      return null;
    }

    void this.send(target, input);
    return null;
  }

  destroy(): void {}

  /**
   * The URL to call, or null while there is nothing callable.
   *
   * A resolved mount address wins over a typed URL — a board that names a
   * service is being explicit about which endpoint it means, and the address is
   * not knowable when the board is written.
   *
   * A reference in either field is "not ready yet" rather than something to
   * dial: it names a service whose address nobody has published, and falling
   * back past it would silently call something else.
   */
  private targetUrl(): string | null {
    const mount = this.state.__hkpMount;
    if (mount) {
      return parseMountRef(mount) ? null : this.requestUrl(mount);
    }
    if (!this.state.url || parseMountRef(this.state.url)) {
      return null;
    }
    return this.requestUrl(this.state.url);
  }

  /** The address to call: the path joined to the base, then the parameters. */
  private requestUrl(base: string): string {
    return this.withQuery(this.join(base));
  }

  private join(base: string): string {
    if (!this.state.path) {
      return base;
    }
    const stem = base.endsWith("/") ? base.slice(0, -1) : base;
    const suffix = this.state.path.startsWith("/")
      ? this.state.path
      : `/${this.state.path}`;
    return `${stem}${suffix}`;
  }

  /**
   * Appends the configured parameters, encoded.
   *
   * Appended rather than replacing what the target already carries: a url or a
   * path may have been written with parameters of its own, and a mount address
   * is not the board's to rewrite.
   */
  private withQuery(target: string): string {
    const params = new URLSearchParams(
      Object.entries(this.state.query),
    ).toString();
    if (!params) {
      return target;
    }
    return `${target}${target.includes("?") ? "&" : "?"}${params}`;
  }

  private async send(url: string, input: any): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.state.timeoutMs);
    const method = this.state.method;
    this.inFlight += 1;
    this.app.notify(this, {
      requesting: true,
      method,
      url,
      inFlight: this.inFlight,
    });

    try {
      const request = this.requestBody(input);
      // Headers are a free-form map, and a credential is as likely to be part
      // of one — `Bearer <token>` — as to be a field of its own. Resolved
      // against the address being called, so a header bound to one host cannot
      // be sent to another by repointing this service.
      const { value: headers, problem } = resolveCredential(
        this.state.headers,
        url,
      );
      if (problem) {
        this.app.notify(this, {
          requesting: false,
          method,
          url,
          status: 0,
          error: problem,
          inFlight: this.inFlight - 1,
        });
        return;
      }

      const sent: Record<string, string> = { ...headers };
      if (request?.contentType && !sent["content-type"]) {
        sent["content-type"] = request.contentType;
      }
      // `userAgent` is part of the shared contract and a board carries it from
      // whichever runtime it was written on, but the browser reserves that
      // header for itself and would drop it: the page says who it is.

      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: sent,
        // A request sends bytes as readily as text, and `fetch` takes them —
        // but the DOM lib types `BodyInit` as a view over a plain ArrayBuffer,
        // which a `Uint8Array` is not guaranteed to be.
        body: request?.body as BodyInit | undefined,
        signal: controller.signal,
      });

      const result = await this.readResponse(url, response);
      this.app.notify(this, {
        requesting: false,
        method,
        url,
        status: response.status,
        // Said on every outcome, so what a panel shows is this request's and
        // not the last failure's still standing.
        error: "",
        inFlight: this.inFlight - 1,
      });
      // Emits as if this service had produced it: the services after this one
      // run with the response, and the runtime's result goes on to the next
      // runtime.
      this.app.next(this, result);
    } catch (err: any) {
      const aborted = err?.name === "AbortError";
      // Status 0: there was no response to have one, so the status of the
      // request before this stops standing as if it were this one's.
      this.app.notify(this, {
        requesting: false,
        method,
        url,
        status: 0,
        error: aborted
          ? `No response within ${this.state.timeoutMs} ms`
          : String(err?.message ?? err),
        inFlight: this.inFlight - 1,
      });
      // A failed request produces no result to pass on: the pipeline behind
      // this service is not called, rather than called with a fabricated one.
    } finally {
      clearTimeout(timer);
      this.inFlight -= 1;
    }
  }

  /**
   * Turns pipeline input into a request body.
   *
   * Accepts what an `http-server-subservices` produces, so a request received
   * on one runtime can be forwarded from another unchanged.
   */
  private requestBody(input: any): RequestBody {
    if (this.state.method === "get") {
      return null;
    }
    if (input === undefined || input === null) {
      // Nothing came down the pipeline, so send the configured body — which is
      // what the panel's body field is for.
      return this.state.body
        ? { body: this.state.body, contentType: "text/plain; charset=utf-8" }
        : null;
    }

    if (typeof input === "string") {
      return { body: input, contentType: "text/plain; charset=utf-8" };
    }
    if (input instanceof Uint8Array) {
      return { body: input, contentType: "application/octet-stream" };
    }
    if (input instanceof ArrayBuffer) {
      return { body: input, contentType: "application/octet-stream" };
    }
    if (input instanceof Blob) {
      return { body: input, contentType: input.type || "application/octet-stream" };
    }

    if (typeof input === "object") {
      const declared =
        typeof input.meta?.contentType === "string"
          ? input.meta.contentType
          : undefined;
      if (input.binary instanceof Uint8Array) {
        return {
          body: input.binary,
          contentType: declared ?? "application/octet-stream",
        };
      }
      if (input.meta !== undefined && input.body !== undefined) {
        return typeof input.body === "string"
          ? {
              body: input.body,
              contentType: declared ?? "text/plain; charset=utf-8",
            }
          : {
              body: JSON.stringify(input.body),
              contentType: declared ?? "application/json",
            };
      }
    }

    return { body: JSON.stringify(input), contentType: "application/json" };
  }

  /**
   * Shapes a response the way `http-server-subservices` shapes a request:
   * metadata always, a decoded body when the content type says what the bytes
   * mean, the bytes themselves when it does not.
   */
  private async readResponse(url: string, response: Response) {
    const contentType = response.headers.get("content-type");
    const type = mediaType(contentType);
    const meta: Record<string, any> = {
      url,
      status: response.status,
      statusText: response.statusText,
      // Cross-origin, this holds what the response exposes rather than
      // everything it carries — the browser hides the rest from the page.
      headers: headerRecord(response.headers),
    };
    if (contentType) {
      meta.contentType = contentType;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      return { meta };
    }

    if (isTextual(type)) {
      const text = new TextDecoder().decode(bytes);
      if (type === "application/json" || type.endsWith("+json")) {
        try {
          return { meta, body: JSON.parse(text) };
        } catch {
          // Declared JSON that is not JSON: hand over the text rather than
          // dropping the response.
          return { meta, body: text };
        }
      }
      return { meta, body: text };
    }

    return { meta, binary: bytes };
  }
}

/**
 * A map of values as a map of strings.
 *
 * A parameter or a header is sent as text whatever it was written as, so a
 * number or a flag typed in an editor arrives as the value it reads as.
 */
function asStrings(map: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = String(value);
    }
  }
  return out;
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new HttpClient(app, board, descriptor, id),
  createUI: HttpClientUI,
};

export default descriptor;
