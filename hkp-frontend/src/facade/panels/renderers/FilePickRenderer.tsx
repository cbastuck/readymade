import { useState, useEffect, useRef, useMemo } from "react";
import { FilePickWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

type UploadState = "idle" | "sending" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePickRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<FilePickWidget>) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const actionService = useMemo(
    () => findService(boardContext, widget.action.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.action.serviceUuid],
  );

  const progressService = useMemo(
    () =>
      widget.progressServiceUuid
        ? findService(boardContext, widget.progressServiceUuid)
        : null,
    [boardContext.scopes, boardContext.services, widget.progressServiceUuid],
  );

  useEffect(() => {
    if (!progressService?.app) {
      return;
    }
    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      const prog = notification?.progress;
      if (typeof prog === "string") {
        setProgress(prog);
        if (prog === "" && uploadState === "sending") {
          setUploadState("done");
        }
      }
    };
    progressService.app.registerNotificationTarget?.(progressService, handler);
    return () => {
      progressService.app.unregisterNotificationTarget?.(progressService, handler);
    };
  }, [progressService, uploadState]);

  const pickFile = (f: File) => {
    setFile(f);
    setUploadState("idle");
    setProgress("");
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setProgress("");
    setUploadState("idle");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 20,
        padding: 24,
      }}
    >
      {uploadState === "done" ? (
        <>
          <div style={{ fontSize: 48 }}>✅</div>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "hsl(var(--foreground))",
              margin: 0,
              textAlign: "center",
            }}
          >
            Sent!
          </p>
          <p
            style={{
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
              margin: 0,
              textAlign: "center",
            }}
          >
            {file?.name}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "1px solid hsl(var(--border))",
              background: "transparent",
              color: "hsl(var(--foreground))",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Send another
          </button>
        </>
      ) : (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                pickFile(f);
              }
            }}
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%",
              maxWidth: 360,
              minHeight: 160,
              border: "2px dashed hsl(var(--border))",
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
              background: "hsl(var(--muted))",
              transition: "border-color 0.15s",
              padding: 20,
            }}
          >
            {preview ? (
              <img
                src={preview}
                alt="preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 120,
                  borderRadius: 8,
                  objectFit: "contain",
                }}
              />
            ) : (
              <span style={{ fontSize: 40 }}>📎</span>
            )}
            {file ? (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {file.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {formatSize(file.size)}
                </div>
              </div>
            ) : (
              <>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "hsl(var(--foreground))",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  {widget.label ?? "Drop a file here"}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "hsl(var(--muted-foreground))",
                    margin: 0,
                  }}
                >
                  or click to browse
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={widget.accept ?? "*/*"}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                pickFile(f);
              }
            }}
          />

          {progress && (
            <p
              style={{
                fontSize: 12,
                color: "hsl(var(--muted-foreground))",
                margin: 0,
                textAlign: "center",
              }}
            >
              {progress}
            </p>
          )}

          <button
            onClick={() => {
              if (!file || !actionService) {
                return;
              }
              setUploadState("sending");
              setProgress("");
              (actionService as any).send?.(file);
            }}
            disabled={!file || uploadState === "sending"}
            style={{
              width: "100%",
              maxWidth: 360,
              padding: "14px 24px",
              borderRadius: 12,
              border: "none",
              background:
                file && uploadState !== "sending"
                  ? "hsl(var(--primary))"
                  : "hsl(var(--muted))",
              color:
                file && uploadState !== "sending"
                  ? "hsl(var(--primary-foreground))"
                  : "hsl(var(--muted-foreground))",
              cursor:
                file && uploadState !== "sending" ? "pointer" : "not-allowed",
              fontSize: 15,
              fontWeight: 600,
              transition: "background 0.15s",
            }}
          >
            {uploadState === "sending" ? "Sending…" : "Send"}
          </button>
        </>
      )}
    </div>
  );
}
