import React, { useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { generateUUID } from "./helpers";

const serviceId = "hookup.to/service/chunked-file-provider";
const serviceName = "Chunked File Provider";

const DEFAULT_CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB — stays under typical 4 MB API gateway limits

export type ChunkPayload = {
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
  chunkIndex: number; // 0-based
  totalChunks: number;
  uploadId: string; // unique per file send — used by the server to reassemble
};

function ChunkedFileProviderUI(props: ServiceUIProps): JSX.Element {
  const [file, setFile] = useState<File | undefined>(undefined);
  const [progress, setProgress] = useState<string>("");

  const onNotification = (params: any) => {
    if (params?.progress !== undefined) setProgress(params.progress);
  };

  return (
    <ServiceUI {...props} onNotification={onNotification}>
      <div style={{ margin: 10 }}>
        <div>
          <input
            type="file"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFile(e.target?.files?.[0] || undefined)
            }
          />
        </div>
        {progress && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
            {progress}
          </div>
        )}
        <div>
          <button
            className="hkp-svc-btn"
            onClick={() => file && (props.service as any).process({ file })}
            disabled={!file}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "10px 16px",
              borderRadius: 8,
              cursor: file ? "pointer" : "not-allowed",
              background: file ? "#007aff" : "#ccc",
              color: "white",
              border: "none",
              fontWeight: 600,
            }}
          >
            Process
          </button>
        </div>
      </div>
    </ServiceUI>
  );
}

function appendTimestamp(filename: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const dot = filename.lastIndexOf(".");
  return dot === -1
    ? `${filename}_${ts}`
    : `${filename.slice(0, dot)}_${ts}${filename.slice(dot)}`;
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
    this.chunkSize = DEFAULT_CHUNK_SIZE;
    this.running = false;
  }

  configure(config: { chunkSize?: number }): void {
    if (config.chunkSize !== undefined) {
      this.chunkSize = config.chunkSize;
    }
  }

  async process(params: { file?: File }): Promise<null> {
    const { file } = params;

    if (!file) {
      console.error(
        "ChunkedFileProvider: process called without a file",
        params,
      );
      return null;
    }

    if (this.running) {
      console.error("ChunkedFileProvider: another upload is in progress");
      return null;
    }

    this.running = true;
    const uploadId = generateUUID();
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const filename = appendTimestamp(file.name);

    const readChunk = (offset: number): void => {
      if (offset >= file.size) {
        this.running = false;
        this.app.notify(this, { progress: "" });
        return;
      }

      const chunkIndex = offset / this.chunkSize;
      this.app.notify(this, {
        progress: `Chunk ${chunkIndex + 1} / ${totalChunks}`,
      });

      const blob = file.slice(
        offset,
        Math.min(offset + this.chunkSize, file.size),
      );
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        const data = e.target!.result as ArrayBuffer;
        const payload: ChunkPayload = {
          data,
          filename,
          mimeType: file.type || "application/octet-stream",
          chunkIndex,
          totalChunks,
          uploadId,
        };
        this.app.next(this, payload);
        readChunk(offset + this.chunkSize);
      };

      reader.onerror = () => {
        console.error(
          "ChunkedFileProvider: FileReader error at offset",
          offset,
        );
        this.running = false;
      };

      reader.readAsArrayBuffer(blob);
    };

    readChunk(0);
    // Return null so the pipeline loop stops here. Each chunk is forwarded
    // to downstream services via app.next() inside the FileReader callbacks.
    return null;
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
