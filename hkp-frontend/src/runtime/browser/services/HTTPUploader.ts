import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import type { ChunkPayload } from "./ChunkedFileProvider";

const serviceId = "hookup.to/service/http-uploader";
const serviceName = "HTTP Uploader";

type State = {
  url: string;
  status: string | null;
};

class HTTPUploader extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { url: "", status: null });
  }

  async configure(config: any) {
    if (config.url !== undefined && config.url !== this.state.url) {
      this.state.url = config.url;
      this.app.notify(this, { url: this.state.url });
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

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type": mimeType,
          "X-Upload-Id": uploadId,
          "X-Chunk-Index": String(chunkIndex),
          "X-Total-Chunks": String(totalChunks),
        },
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
