import React, { Component } from 'react';
import {
  Button,
  Input,
} from 'semantic-ui-react';

import { WritableStream } from "web-streams-polyfill/ponyfill";
import StreamSaver from 'streamsaver';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/downloader';
const serviceName = 'Downloader';

// Apply the polyfill if needed
if (!StreamSaver.WritableStream) {
  StreamSaver.WritableStream = WritableStream;
}


class DownloaderUI extends Component {
  constructor(props) {
    super(props);
    this.state = {
      filename: undefined
    };
  }

  onClose = service => {
    if (service) {
      service.onClose();
      service.configure({ autosense: false });
    }
  }

  render() {
    const { service, runtimeId } = this.props;
    return (
      <ServiceUI
        backendService={service}
        runtimeId={runtimeId}
        onTimer={service => this.setState({ running: service.running })}
      >
      {
        ({ service }) => (
          <div
            style={{ margin: "10px 0px" }}
          >
            <div style={{ textAlign: 'left', margin: '0px 10px' }}>
              Filename
            </div>
            <div style={{ margin: 10 }}>
              <Input
                value={this.state.filename || service.filename}
                onChange={(_, { value }) => this.setState({ filename: value })}
                onKeyUp={ev => ev.key === 'Enter' && service.configure({ filename: this.state.filename, autosense: true })}
              />
            </div>
            <Button
              disabled={!this.state.running}
              onClick={() => this.onClose(service)}
            >
              Close
            </Button>
          </div>
        )
      }
      </ServiceUI>
    );
  }
}

class Downloader {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;

    this._fileStream = undefined;
    this._writer = undefined;
    this.filename = "incoming.txt"
    this.autosense = true;
    this.running = false;
  }

  configure(config) {
    if (config.filename !== undefined) {
      this.openDestination(config.filename);
    }
    if (config.autosense !== undefined) {
      this.autosense = config.autosense;
    }
  }

  openDestination(filename) {
    this.onClose();
    this.filename = filename;
    this._fileStream = StreamSaver.createWriteStream(filename);
    this._writer = this._fileStream.getWriter();
    this.running = true;
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
  }

  async pump(reader, writer) {
    const res = await reader.read();
    if (!res.done) {
      await writer.write(res.value)
      this.pump(reader, writer);
    }
  }

  async process(params) {
    if (!this.isOpen()) {
      if (!this.autosense) {
        return params;
      } else {
        this.openDestination(this.filename)
      }
    } 
    const blob = (params instanceof Blob) ? params : new Blob([JSON.stringify(params)]);
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
  createUI: DownloaderUI
};

export default descriptor;
