import React, { Component } from "react";

import { BoardConsumer } from "../../../BoardContext";

const serviceId = "hookup.to/service/chunked-file-provider";
const serviceName = "Chunked File Provider";

class ChunkedFileProviderUI extends Component {
  state = {
    file: undefined,
  };

  processFile = (boardContext, file) => {
    const runtime = boardContext.getCurrentBrowserRuntime(this.props.runtimeId);
    if (runtime) {
      const service = runtime.getServiceById(this.props.service.uuid);
      service && service.process({ file });
    } else {
      console.error("FileProvider service/runtime not found");
    }
  };

  render() {
    return (
      <BoardConsumer>
        {(boardContext) => (
          <div
            style={{
              margin: 10,
            }}
          >
            <div>
              <input
                type="file"
                onChange={(e) =>
                  this.setState({
                    file: e.target && e.target.files && e.target.files[0],
                  })
                }
              />
            </div>
            <div>
              <button
                onClick={() => this.processFile(boardContext, this.state.file)}
                disabled={!this.state.file}
                style={{
                  width: "100%",
                  marginTop: 10,
                }}
              >
                Process
              </button>
            </div>
          </div>
        )}
      </BoardConsumer>
    );
  }
}

class ChunkedFileProvider {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.chunkSize = 1024 * 1024;
    this.running = false;
  }

  configure(config) {
    if (config.chunkSize !== undefined) {
      this.chunkSize = config.chunkSize;
    }
  }

  async process(params) {
    const { file } = params;

    if (!file) {
      return console.error(
        "Calling FileProvider process with invalid parameter",
        params
      );
    }

    if (this.running) {
      return console.error("Another file upload is in process - wait");
    }

    this.running = true;

    const onFinished = () => {
      this.running = false;
    };

    const processingFileSize = file.size;
    const handleChunk = (callback, e) => {
      const contents = e.target.result;
      const blob = new Blob([contents], { type: "application/octet-stream" });
      this.app.next(this, blob);
      callback();
    };

    const readChunk = (offset) => {
      if (offset >= processingFileSize) {
        return onFinished();
      }
      const blob = file.slice(
        offset,
        Math.min(offset + this.chunkSize, processingFileSize)
      );
      const reader = new FileReader();
      reader.onload = handleChunk.bind(this, () =>
        readChunk(offset + this.chunkSize)
      );
      reader.readAsArrayBuffer(blob);
    };

    readChunk(0);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new ChunkedFileProvider(app, board, descriptor, id),
  createUI: ChunkedFileProviderUI,
};

export default descriptor;
