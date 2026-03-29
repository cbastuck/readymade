import React, { Component } from "react";

import { WritableStream } from "web-streams-polyfill/ponyfill";
import StreamSaver from "streamsaver";

import ServiceUI from "../../services/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/downloader";
const serviceName = "Downloader";

// Apply the polyfill if needed
if (!StreamSaver.WritableStream) {
  StreamSaver.WritableStream = WritableStream;
}

type DownloaderUIState = {
  filename: string | undefined;
  running?: boolean;
};

class DownloaderUI extends Component<any, DownloaderUIState> {
  constructor(props: any) {
    super(props);
    this.state = {
      filename: undefined,
    };
  }

  onInit = (initialState: { filename: string }): void => {
    this.setState({
      filename: initialState.filename,
    });
  };

  onNotification = (notification: { running?: boolean }): void => {
    const { running } = notification;
    if (running !== undefined) {
      this.setState({ running });
    }
  };

  onClose = (service: any): void => {
    if (service) {
      service.onClose();
      // service.configure({ autosense: false });
    }
  };

  renderMain = (service: any): JSX.Element => (
    <div
      style={{ display: "flex", flexDirection: "column", textAlign: "left" }}
    >
      <div style={s(t.ls1, t.fs12)}>Filename</div>
      <div style={t.mt3}>
        <input
          style={s(t.w100, { margin: 0 })}
          value={this.state.filename || service.filename}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ filename: e.target.value })}
          onKeyUp={(ev: React.KeyboardEvent<HTMLInputElement>) =>
            ev.key === "Enter" &&
            service.configure({
              filename: this.state.filename,
              autosense: true,
            })
          }
        />
      </div>
      <div style={t.mt3}>
        <button
          style={s(t.ls1, t.fs12, t.w100)}
          disabled={!this.state.running}
          onClick={() => this.onClose(service)}
        >
          Close
        </button>
      </div>
    </div>
  );

  render(): JSX.Element {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
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

  async pump(reader: ReadableStreamDefaultReader<Uint8Array>, writer: any): Promise<void> {
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
