import React from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceId = "hookup.to/service/file-source";
const serviceName = "File Source";

function FileSourceUI(props: any): JSX.Element {
  const renderMain = (service: any): JSX.Element => {
    return (
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
      </div>
    );
  };

  return (
    <ServiceUI {...props} segments={[{ name: "Main", render: renderMain }]} />
  );
}

class FileSource {
  uuid: string;
  board: any;
  app: any;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(_config: any): void {}

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
    resume(content);
  }

  async loadFiles(fileList: FileList): Promise<void> {
    const resume =
      this.app.defer?.(this) ??
      ((result: any) => this.app.next(this, result));
    const r: (string | ArrayBuffer | null)[] = [];
    for (const file of fileList) {
      r.push(await this.loadFile(file));
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
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new FileSource(app, board, _descriptor, id),
  createUI: FileSourceUI,
};

export default descriptor;
