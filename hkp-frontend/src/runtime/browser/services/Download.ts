/**
 * Service Documentation
 * Service ID: hookup.to/service/download
 * Service Name: Download
 * Runtime: browser
 * Key Config: filename, mimeType
 * IO: in=string | Uint8Array | ArrayBuffer | JSON -> out=the same input
 *
 * Saves whatever reaches it as a file, through the browser's own download:
 * text as it is, bytes as they are, anything else as its JSON. The input
 * travels on unchanged, so a download can sit in the middle of a pipeline as
 * well as at its end.
 *
 * `filename` is what the file is offered as; a board that saves several
 * different things configures it before each one (e.g. `{{item.name}}.sql`).
 * `mimeType` left empty is decided by the input: text/plain for text,
 * application/octet-stream for bytes, application/json for anything else.
 */
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import ServiceBase from "./ServiceBase";
import DownloadUI from "./DownloadUI";

const serviceId = "hookup.to/service/download";
const serviceName = "Download";

type State = {
  filename: string;
  mimeType: string;
};

/** The input as a file's content, with the type it would be saved as. */
function fileContent(
  input: unknown,
  mimeType: string,
): { part: BlobPart; type: string } {
  if (typeof input === "string") {
    return { part: input, type: mimeType || "text/plain;charset=utf-8" };
  }
  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    return {
      part: input as BlobPart,
      type: mimeType || "application/octet-stream",
    };
  }
  return {
    part: JSON.stringify(input, null, 2),
    type: mimeType || "application/json",
  };
}

class Download extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { filename: "download.txt", mimeType: "" });
  }

  configure(config: any): void {
    if (
      typeof config.filename === "string" &&
      needsUpdate(config.filename, this.state.filename)
    ) {
      this.state.filename = config.filename;
      this.app.notify(this, { filename: this.state.filename });
    }
    if (
      typeof config.mimeType === "string" &&
      needsUpdate(config.mimeType, this.state.mimeType)
    ) {
      this.state.mimeType = config.mimeType;
      this.app.notify(this, { mimeType: this.state.mimeType });
    }
  }

  process(input: any): any {
    if (input === undefined || input === null) {
      return input;
    }
    const filename = this.state.filename.trim() || "download.txt";
    const { part, type } = fileContent(input, this.state.mimeType);
    const blob = new Blob([part], { type });
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // The download has started from the link; the URL is only needed until
      // the browser has read it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.app.notify(this, { saved: filename, bytes: blob.size, error: "" });
    } catch (err) {
      const error = `could not save ${filename}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      this.app.log(this, "error", "service.failed", { message: error });
      this.app.notify(this, { error });
    }
    return input;
  }
}

export default {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Download(app, board, descriptor, id),
  createUI: DownloadUI,
};
