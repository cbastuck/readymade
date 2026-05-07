import React, { useRef, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceId = "hookup.to/service/image-picker";
const serviceName = "Image Picker";

// ─── UI ──────────────────────────────────────────────────────────────────────

function ImagePickerUI(props: ServiceUIProps): JSX.Element {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <ServiceUI {...props}>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
        <button
          className="hkp-svc-btn"
          onClick={() => inputRef.current?.click()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            background: "#007aff",
            color: "white",
            border: "none",
            fontWeight: 600,
          }}
        >
          Choose Image
        </button>
        {preview && (
          <img
            src={preview}
            alt="preview"
            style={{
              maxWidth: "100%",
              borderRadius: 8,
              maxHeight: 200,
              objectFit: "contain",
            }}
          />
        )}
        <button
          className="hkp-svc-btn"
          onClick={() => file && (props.service as any).send(file)}
          disabled={!file}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            cursor: file ? "pointer" : "not-allowed",
            background: file ? "#34c759" : "#ccc",
            color: "white",
            border: "none",
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>
    </ServiceUI>
  );
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ImagePicker {
  uuid: string;
  board: any;
  app: any;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(_config: any): void {}

  /** Called by the UI when the user taps Send */
  send(file: File): void {
    this.app.next(this, { file });
  }

  process(params: any): any {
    return params;
  }
}

// ─── Descriptor ──────────────────────────────────────────────────────────────

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new ImagePicker(app, board, _descriptor, id),
  createUI: ImagePickerUI as any,
};

export default descriptor;
