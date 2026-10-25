import React, { useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/file-source";
const serviceName = "File Source";

type State = {
  /** Characters per chunk; 0 sends a file whole. */
  chunkSize: number;
};

function FileSourceUI(props: any): JSX.Element {
  const { service } = props;
  const [chunkSize, setChunkSize] = useState(0);

  const read = (state: any) => {
    if (typeof state?.chunkSize === "number") {
      setChunkSize(state.chunkSize);
    }
  };

  return (
    <ServiceUI {...props} onInit={read} onNotification={read}>
      <div
        style={{
          margin: "0px 5px",
          textAlign: "left",
        }}
      >
        <input
          type="file"
          onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
            service.loadFiles(ev.target.files)
          }
          multiple
        />
        {/* Empty or 0 sends each file whole. */}
        <InputField
          label="Chunk size"
          value={chunkSize > 0 ? `${chunkSize}` : ""}
          onChange={(value) =>
            service.configure({ chunkSize: Number(value) || 0 })
          }
        />
      </div>
    </ServiceUI>
  );
}

/**
 * Text cut into pieces of at most `size` characters, in order.
 *
 * Never between the two halves of a surrogate pair: each half alone is not a
 * character, and a runtime that decodes a chunk on its own would see two
 * broken ones. An empty text is one empty piece, so an empty file still
 * arrives as something.
 */
export function chunkText(text: string, size: number): string[] {
  if (text.length === 0) {
    return [""];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length && end - start > 1) {
      const last = text.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) {
        end -= 1;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

class FileSource extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { chunkSize: 0 });
  }

  configure(config: Partial<State>): void {
    if (
      typeof config.chunkSize === "number" &&
      Number.isFinite(config.chunkSize) &&
      config.chunkSize >= 0
    ) {
      this.state.chunkSize = Math.floor(config.chunkSize);
      this.app.notify(this, { chunkSize: this.state.chunkSize });
    }
  }

  async loadFile(file: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.addEventListener("load", (event: ProgressEvent<FileReader>) => {
          resolve((event.target as FileReader).result);
        });
        //reader.readAsArrayBuffer(file);
        reader.readAsText(file);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * A file's content as it goes on: whole, or — with a chunk size — as an
   * array of its pieces, even when there is only one, so what follows does not
   * change shape with the size of the file. Sending the pieces on one by one is
   * a Spread's to do.
   */
  private chunked(
    content: string | ArrayBuffer | null,
  ): string | string[] | ArrayBuffer | null {
    return typeof content === "string" && this.state.chunkSize > 0
      ? chunkText(content, this.state.chunkSize)
      : content;
  }

  /**
   * One file, handed over by a facade's `file-pick` widget: read as text and
   * emitted like a file picked in the panel. `progress` is what the widget
   * shows while it waits, and an empty one tells it the file has gone on.
   */
  async send(file: File): Promise<void> {
    const resume =
      this.app.defer?.(this) ??
      ((result: any) => this.app.next(this, result));
    this.app.notify(this, { progress: `Reading ${file.name}…` });
    const content = await this.loadFile(file);
    this.app.notify(this, { progress: "" });
    resume(this.chunked(content));
  }

  async loadFiles(fileList: FileList): Promise<void> {
    const resume =
      this.app.defer?.(this) ??
      ((result: any) => this.app.next(this, result));
    const r: (string | string[] | ArrayBuffer | null)[] = [];
    for (const file of fileList) {
      r.push(this.chunked(await this.loadFile(file)));
    }
    resume(r.length === 1 ? r[0] : r);
  }

  process(params: any): any {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, descriptor: any, id: string) =>
    new FileSource(app, board, descriptor, id),
  createUI: FileSourceUI,
};

export default descriptor;
