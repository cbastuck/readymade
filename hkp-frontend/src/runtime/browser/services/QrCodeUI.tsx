import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import Editor, {
  EditorHandle,
} from "hkp-frontend/src/components/shared/Editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import {
  compressAndEncodeState,
  decompressAndDecodeState,
} from "hkp-frontend/src/common";

export default function QrCodeUI(props: ServiceUIProps) {
  const [url, setUrl] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  const onInit = (state: any) => {
    if (needsUpdate(state.url, url)) {
      setUrl(state.url ?? "");
    }
  };

  const onNotification = (params: any) => {
    if (params?.url !== undefined) {
      setUrl(params.url);
    }
  };

  const onApply = () => {
    const value = editorRef.current?.getValue() ?? "";
    props.service.configure({ url: value.trim() });
    setIsEditorOpen(false);
    setError(null);
  };

  const onCompress = () => {
    setError(null);
    const editor = editorRef.current;
    if (!editor) return;

    const selected = editor.getSelectionText();
    const source = selected ?? editor.getValue() ?? "";
    if (!source.trim()) return;

    try {
      // Validate it's parseable JSON before compressing
      JSON.parse(source);
    } catch {
      setError("Selection is not valid JSON — fix it before compressing.");
      return;
    }

    const compressed = compressAndEncodeState(source);
    if (selected !== null) {
      editor.replaceSelection(compressed);
    } else {
      editor.setValue(compressed);
    }
  };

  const onDecompress = () => {
    setError(null);
    const editor = editorRef.current;
    if (!editor) return;

    const selected = editor.getSelectionText();
    const source = selected ?? editor.getValue() ?? "";
    if (!source.trim()) return;

    try {
      const decompressed = decompressAndDecodeState(source.trim());
      if (!decompressed) {
        setError(
          "Could not decompress — is the selection a valid lz-string payload?",
        );
        return;
      }
      // Pretty-print if valid JSON
      let output = decompressed;
      try {
        output = JSON.stringify(JSON.parse(decompressed), null, 2);
      } catch {
        // not JSON, keep as-is
      }
      if (selected !== null) {
        editor.replaceSelection(output);
      } else {
        editor.setValue(output);
      }
    } catch {
      setError("Decompression failed.");
    }
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 220, height: undefined }}
    >
      <div className="flex flex-col items-center justify-center p-3 gap-2">
        {url ? (
          <QRCodeCanvas value={url} size={160} />
        ) : (
          <div
            style={{ width: 160, height: 160 }}
            className="flex items-center justify-center bg-gray-100 text-gray-400 text-xs rounded"
          >
            No URL
          </div>
        )}
        {url && (
          <a
            className="text-xs text-gray-500 truncate text-center w-[180px]"
            href={url}
          >
            {url}
          </a>
        )}
        <Button
          variant="outline"
          className="hkp-svc-btn w-full text-xs"
          onClick={() => {
            setError(null);
            setIsEditorOpen(true);
          }}
        >
          Edit URL
        </Button>
      </div>

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open);
          setError(null);
        }}
      >
        <DialogContent
          className="sm:max-w-[80%] h-[60vh] flex flex-col"
          aria-describedby="qr-url-editor-description"
        >
          <DialogTitle>QR Code URL</DialogTitle>
          <DialogDescription
            id="qr-url-editor-description"
            className="text-xs text-gray-500"
          >
            Select a compressed <code>fromLink</code> payload and click{" "}
            <strong>Decompress</strong> to expand it to JSON, or select JSON and
            click <strong>Compress</strong> to produce the payload. With no
            selection, the entire editor content is used.
          </DialogDescription>

          <div className="flex-1 min-h-0">
            <Editor
              ref={(editor) => {
                editorRef.current = editor;
              }}
              value={url}
              language="plaintext"
              autofocus
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <DialogFooter className="flex flex-wrap gap-2 justify-between">
            <div className="flex gap-2">
              <Button className="hkp-svc-btn" variant="outline" onClick={onDecompress}>
                Decompress
              </Button>
              <Button className="hkp-svc-btn" variant="outline" onClick={onCompress}>
                Compress
              </Button>
            </div>
            <Button className="hkp-svc-btn" onClick={onApply}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ServiceUI>
  );
}
