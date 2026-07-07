import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import type { ChunkPayload } from "./ChunkedFileProvider";

const serviceId = "hookup.to/service/http-uploader";
const serviceName = "HTTP Uploader";

type State = {
  url: string;
  status: string | null;
  // Scoped, short-lived capability token minted by the trusted host and baked
  // into this board via the QR link. Sent as a bearer credential so an
  // unauthenticated device (a phone) can push to the one upload runtime it was
  // granted, without a user session. Empty when uploading to an unauthenticated
  // target (e.g. a loopback runtime).
  authToken: string;
};

class HTTPUploader extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { url: "", status: null, authToken: "" });
  }

  async configure(config: any) {
    if (config.url !== undefined && config.url !== this.state.url) {
      this.state.url = config.url;
      this.app.notify(this, { url: this.state.url });
    }
    if (config.authToken !== undefined && config.authToken !== this.state.authToken) {
      this.state.authToken = config.authToken;
      // Deliberately not notified: the token is a secret, kept out of the
      // notification stream (and thus out of UI/logs).
    }
  }

  async process(params: ChunkPayload): Promise<any> {
    const { url } = this.state;
    if (!url) {
      console.error("HTTPUploader: no url configured");
      return params;
    }

    const { data, filename, mimeType, chunkIndex, totalChunks, uploadId } =
      params;

    const status = `Uploading chunk ${chunkIndex + 1} / ${totalChunks}`;
    this.state.status = status;
    this.app.notify(this, { status });

    const headers: Record<string, string> = {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": mimeType,
      "X-Upload-Id": uploadId,
      "X-Chunk-Index": String(chunkIndex),
      "X-Total-Chunks": String(totalChunks),
    };
    if (this.state.authToken) {
      headers["Authorization"] = `Bearer ${this.state.authToken}`;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: data,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const done = chunkIndex + 1 === totalChunks;
      const newStatus = done ? null : status;
      this.state.status = newStatus;
      this.app.notify(this, { status: newStatus });
    } catch (err: any) {
      this.state.status = `Error: ${err.message}`;
      this.app.notify(this, { status: this.state.status });
      console.error("HTTPUploader error", err);
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
  ) => new HTTPUploader(app, board, descriptor, id),
};

export default descriptor;
