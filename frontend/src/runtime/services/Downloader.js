import React, { Component } from 'react';
import {
  Button,
  Input,
} from 'semantic-ui-react';

import StreamSaver from 'streamsaver';

import { BoardConsumer } from '../../BoardContext';

const serviceId = 'hookup.to/service/downloader';
const serviceName = 'Downloader';

class DownloaderUI extends Component {
  constructor(props) {
    super(props);
    this.state = {
      filename: "sample.txt"
    };
  }

  onButton = boardContext => {
    const runtime = boardContext.getCurrentBrowserRuntime(this.props.runtimeId);
    if (runtime) {
      const service = runtime.getServiceById(this.props.service.uuid)
      service && service.configure({ filename: this.state.filename });
    }
  }

  onClose = boardContext => {
    const runtime = boardContext.getCurrentBrowserRuntime(this.props.runtimeId);
    if (runtime) {
      const service = runtime.getServiceById(this.props.service.uuid)
      service && service.onClose();
    }
  }

  render() {
    return (
      <BoardConsumer>
      {
        boardContext => (
          <div
            style={{
              margin: "10px 0px"
            }}
          >
            <div style={{ textAlign: 'left', margin: '0px 10px' }}>Filename</div>
            <div
              style={{ margin: 10 }}
            >
              <Input
                value={this.state.filename}
                onChange={(_, { value }) => {
                  this.setState({ filename: value });
                }}
              />
            </div>
            <Button
              onClick={() => this.onButton(boardContext)}
            >
              New File
            </Button>
            <Button
              onClick={() => this.onClose(boardContext)}
            >
              Close File
            </Button>
          </div>
        )
      }
      </BoardConsumer>
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
  }

  configure(config) {
    if (config.filename) {
      this.onClose();
      this._fileStream = StreamSaver.createWriteStream(config.filename);
      this._writer = this._fileStream.getWriter();
    }
  }

  onClose() {
    if (this._writer) {

      this._writer.close();
    }
    this._fileStream = undefined;
    this._writer = undefined;
  }

  async pump(reader, writer) {
    const res = await reader.read();
    if (!res.done) {
      await writer.write(res.value)
      this.pump(reader, writer);
    }
  }

  async process(params) {
    if (this._writer !== undefined) { 
      const blob = (params instanceof Blob) ? params : new Blob([JSON.stringify(params)]);
      const readableStream = blob.stream();
      const reader = readableStream.getReader();
      this.pump(reader, this._writer);
    }
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
