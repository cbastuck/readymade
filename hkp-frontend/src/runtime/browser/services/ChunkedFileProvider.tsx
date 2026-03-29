import React, { useState } from "react";

import { BoardConsumer } from "../../../BoardContext";

const serviceId = "hookup.to/service/chunked-file-provider";
const serviceName = "Chunked File Provider";

type ChunkedFileProviderUIProps = {
  runtimeId: string;
  service: { uuid: string };
};

function ChunkedFileProviderUI(props: ChunkedFileProviderUIProps): JSX.Element {
  const [file, setFile] = useState<File | undefined>(undefined);

  const processFile = (boardContext: any, f: File | undefined): void => {
    const runtime = boardContext.getCurrentBrowserRuntime(props.runtimeId);
    if (runtime) {
      const service = runtime.getServiceById(props.service.uuid);
      service && service.process({ file: f });
    } else {
      console.error("FileProvider service/runtime not found");
    }
  };

  return (
    <BoardConsumer>
      {(boardContext: any) => (
        <div
          style={{
            margin: 10,
          }}
        >
          <div>
            <input
              type="file"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFile(e.target && e.target.files && e.target.files[0] || undefined)
              }
            />
          </div>
          <div>
            <button
              onClick={() => processFile(boardContext, file)}
              disabled={!file}
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

class ChunkedFileProvider {
  uuid: string;
  board: any;
  app: any;
  chunkSize: number;
  running: boolean;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.chunkSize = 1024 * 1024;
    this.running = false;
  }

  configure(config: { chunkSize?: number }): void {
    if (config.chunkSize !== undefined) {
      this.chunkSize = config.chunkSize;
    }
  }

  async process(params: { file?: File }): Promise<void> {
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

    const onFinished = (): void => {
      this.running = false;
    };

    const processingFileSize = file.size;
    const handleChunk = (callback: () => void, e: ProgressEvent<FileReader>): void => {
      const contents = (e.target as FileReader).result;
      const blob = new Blob([contents as ArrayBuffer], { type: "application/octet-stream" });
      this.app.next(this, blob);
      callback();
    };

    const readChunk = (offset: number): void => {
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
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new ChunkedFileProvider(app, board, _descriptor, id),
  createUI: ChunkedFileProviderUI as any,
};

export default descriptor;
