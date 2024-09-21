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

class DownloaderUI extends Component {
  constructor(props) {
    super(props);
    this.state = {
      filename: undefined,
    };
  }

  onInit = (initialState) => {
    this.setState({
      filename: initialState.filename,
    });
  };

  onNotification = (notification) => {
    const { running } = notification;
    if (running !== undefined) {
      this.setState({ running });
    }
  };

  onClose = (service) => {
    if (service) {
      service.onClose();
      // service.configure({ autosense: false });
    }
  };

  renderMain = (service) => (
    <div
      style={{ display: "flex", flexDirection: "column", textAlign: "left" }}
    >
      <div style={s(t.ls1, t.fs12)}>Filename</div>
      <div style={t.mt3}>
        <input
          style={s(t.w100, { margin: 0 })}
          value={this.state.filename || service.filename}
          onChange={(_, { value }) => this.setState({ filename: value })}
          onKeyUp={(ev) =>
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

  render() {
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
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this._fileStream = undefined;
    this._writer = undefined;
    this.filename = "incoming.txt";
    this.autosense = true;
    this.running = false;
  }

  configure(config) {
    const { filename, autosense } = config;
    if (filename !== undefined) {
      this.openDestination(filename);
    }

    if (autosense !== undefined) {
      this.autosense = autosense;
    }
  }

  openDestination(filename) {
    console.log("Opening destination");
    this.onClose();
    this.filename = filename;
    this._fileStream = StreamSaver.createWriteStream(filename);
    this._writer = this._fileStream.getWriter();
    this.running = true;
    this.app.notify(this, { running: this.running });
  }

  isOpen() {
    return this._fileStream !== undefined;
  }

  onClose() {
    if (this._writer) {
      this._writer.close();
    }
    this._fileStream = undefined;
    this._writer = undefined;
    this.running = false;
    this.app.notify(this, { running: this.running });
  }

  async pump(reader, writer) {
    const res = await reader.read();
    if (!res.done) {
      await writer.write(res.value);
      this.pump(reader, writer);
    }
  }

  async process(params) {
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
  create: (app, board, descriptor, id) =>
    new Downloader(app, board, descriptor, id),
  createUI: DownloaderUI,
};

export default descriptor;
