import React, { useState } from "react";

import { WritableStream } from "web-streams-polyfill/ponyfill";
import StreamSaver from "streamsaver";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/downloader";
const serviceName = "Downloader";

// Apply the polyfill if needed
if (!StreamSaver.WritableStream) {
  StreamSaver.WritableStream = WritableStream;
}

function DownloaderUI(props: any): JSX.Element {
  const [filename, setFilename] = useState<string | undefined>(undefined);
  const [running, setRunning] = useState<boolean | undefined>(undefined);

  const onInit = (initialState: { filename: string }): void => {
    setFilename(initialState.filename);
  };

  const onNotification = (notification: { running?: boolean }): void => {
    const { running: newRunning } = notification;
    if (newRunning !== undefined) {
      setRunning(newRunning);
    }
  };

  const onClose = (service: any): void => {
    if (service) {
      service.onClose();
      // service.configure({ autosense: false });
    }
  };

  const renderMain = (service: any): JSX.Element => (
    <div
      style={{ display: "flex", flexDirection: "column", textAlign: "left" }}
    >
      <div style={s(t.ls1, t.fs12)}>Filename</div>
      <div style={t.mt3}>
        <input
          style={s(t.w100, { margin: 0 })}
          value={filename || service.filename}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFilename(e.target.value)
          }
          onKeyUp={(ev: React.KeyboardEvent<HTMLInputElement>) =>
            ev.key === "Enter" &&
            service.configure({
              filename: filename,
              autosense: true,
            })
          }
        />
      </div>
      <div style={t.mt3}>
        <button
          style={s(t.ls1, t.fs12, t.w100)}
          disabled={!running}
          onClick={() => onClose(service)}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "main", render: renderMain }]}
    />
  );
}

class Downloader {
  uuid: string;
  board: any;
  app: any;
  _fileStream: any;
  _writer: any;
  filename: string;
  autosense: boolean;
  running: boolean;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this._fileStream = undefined;
    this._writer = undefined;
    this.filename = "incoming.txt";
    this.autosense = true;
    this.running = false;
  }

  configure(config: { filename?: string; autosense?: boolean }): void {
    const { filename, autosense } = config;
    if (filename !== undefined) {
      this.openDestination(filename);
    }

    if (autosense !== undefined) {
      this.autosense = autosense;
    }
  }

  openDestination(filename: string): void {
    console.log("Opening destination");
    this.onClose();
    this.filename = filename;
    this._fileStream = StreamSaver.createWriteStream(filename);
    this._writer = this._fileStream.getWriter();
    this.running = true;
    this.app.notify(this, { running: this.running });
  }

  isOpen(): boolean {
    return this._fileStream !== undefined;
  }

  onClose(): void {
    if (this._writer) {
      this._writer.close();
    }
    this._fileStream = undefined;
    this._writer = undefined;
    this.running = false;
    this.app.notify(this, { running: this.running });
  }

  async pump(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    writer: any,
  ): Promise<void> {
    const res = await reader.read();
    if (!res.done) {
      await writer.write(res.value);
      this.pump(reader, writer);
    }
  }

  async process(params: any): Promise<any> {
    if (!this.isOpen()) {
      if (!this.autosense) {
        return params;
      }
      this.openDestination(this.filename);
    }
    const blob =
      params instanceof Blob ? params : new Blob([JSON.stringify(params)]);
    const readableStream = blob.stream();
    const reader = readableStream.getReader();
    await this.pump(reader, this._writer);

    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Downloader(app, board, _descriptor, id),
  createUI: DownloaderUI,
};

export default descriptor;
