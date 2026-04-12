import { useState } from "react";
import {
  CircleX,
  SquarePlay,
  Pencil,
  ScanText,
  Speech,
  SquareCode,
  TerminalSquare,
} from "lucide-react";
import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";

import { ServiceUIProps } from "hkp-frontend/src/types";
import Editor from "hkp-frontend/src/components/shared/Editor/index";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { isBlob } from "./helpers";

export default function MonitorUI(props: ServiceUIProps) {
  const [message, setMessage] = useState("");
  const [renderTextEditor, setRenderTextEditor] = useState(true);
  const [asciiMode, setAsciiMode] = useState(false);
  // Read width/height synchronously from the service so Resizable gets them on first render.
  const [initialSize] = useState(() => {
    const svc = props.service as any;
    return { width: svc.width ?? 278, height: svc.height ?? undefined };
  });
  const onInit = (state: any) => {
    if (needsUpdate(state.message, message)) {
      setMessage(state.message);
    }
    if (needsUpdate(state.renderTextEditor, renderTextEditor)) {
      setRenderTextEditor(state.renderTextEditor);
    }
    if (state.mode === "ascii") {
      setAsciiMode(true);
    }
  };

  const onNotification = (params: any) => {
    // Mode change from service configure()
    if (params?.mode !== undefined) {
      setAsciiMode(params.mode === "ascii");
      return;
    }

    if (typeof params?.ascii === "string") {
      setMessage(params.ascii);
      return;
    }

    const type = typeof params;
    if (type === "string") {
      setMessage(params);
    } else if (type === "number") {
      setMessage(`${params}`);
    } else if (params instanceof ArrayBuffer) {
      const hexView = createHexView(params);
      setMessage(`ArrayBuffer (${params.byteLength} bytes): \n\n${hexView}`);
    } else if (Array.isArray(params)) {
      setMessage(JSON.stringify(params));
    } else if (isBlob(params)) {
      setMessage(`Blob (${params.type} ${params.size} bytes)`);
    } else {
      const nil = params === null && "<null>";
      const undef = params === undefined && "<undefined>";
      const { bypass, __internal, ...rest } = params || {};
      const s = nil || undef || unroll(rest);
      if (bypass !== undefined || __internal !== undefined) {
        return;
      }
      setMessage(isObject(s) ? JSON.stringify(s, null, 2) : s);
    }
  };

  const switchEditor = () => setRenderTextEditor(!renderTextEditor);

  const clearEditor = () => setMessage("");

  const onFormatJSON = () => {
    try {
      const obj = JSON.parse(message);
      setMessage(JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error("MonitorUI.onFormatJSON", err);
    }
  };

  const toggleAsciiMode = () => setAsciiMode((prev) => !prev);

  const { service } = props;
  const customMenuEntries = [
    {
      name: "Clear Buffer",
      icon: <MenuIcon icon={CircleX} />,
      onClick: clearEditor,
    },
    {
      name: asciiMode ? "Standard Mode" : "Ascii Mode",
      icon: <MenuIcon icon={TerminalSquare} />,
      onClick: toggleAsciiMode,
    },
    {
      name: renderTextEditor ? "Edit Mode" : "Close Edit Mode",
      icon: renderTextEditor ? (
        <MenuIcon icon={Pencil} />
      ) : (
        <MenuIcon icon={ScanText} />
      ),
      onClick: switchEditor,
    },
    {
      name: "Inject Buffer",
      icon: <MenuIcon icon={SquarePlay} />,
      onClick: () => {
        let data;
        try {
          data = JSON.parse(message);
        } catch (_err) {
          data = message;
        }
        service.app.next(service, data);
      },
    },
    {
      name: "Prettify",
      icon: <MenuIcon icon={SquareCode} />,
      onClick: onFormatJSON,
    },
    {
      name: "Read it",
      icon: <MenuIcon icon={Speech} />,
      onClick: () => {
        const utterance = new SpeechSynthesisUtterance(message);
        speechSynthesis.speak(utterance);
      },
      disabled: !message || !speechSynthesis,
    },
  ];

  const renderEditor = () => {
    if (asciiMode) {
      return (
        <pre
          style={{
            margin: "5px 0",
            padding: "8px",
            background: "#111",
            color: "#c8ffc8",
            fontFamily: "monospace",
            fontSize: "7px",
            lineHeight: 1.15,
            whiteSpace: "pre",
            overflowX: "hidden",
            overflowY: "hidden",
            borderRadius: 4,
            flexGrow: 1,
          }}
        >
          {message}
        </pre>
      );
    }

    return renderTextEditor ? (
      <Textarea
        className="text-base border-none"
        style={{
          margin: "5px 0px",
          fontFamily: "monospace",
          resize: "none",
          borderRadius: 5,
          flexGrow: 1,
        }}
        value={message}
        rows={8}
        cols={30}
        readOnly
      />
    ) : (
      <Editor
        value={message}
        language="json"
        onChange={(val) => val && setMessage(val)}
      />
    );
  };

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
      initialSize={initialSize}
    >
      {renderEditor()}
    </ServiceUI>
  );
}

function isObject(obj: any) {
  return typeof obj === "object" && obj !== null;
}

function unroll(params: any): any {
  const type = typeof params;
  if (type === "string") {
    return params;
  }
  const isBlob = params instanceof Blob;
  if (isBlob) {
    return `Blob (${params.type} ${params.size} bytes)`;
  }

  const isUint8Array = params instanceof Uint8Array;
  if (isUint8Array) {
    return `Uint8Array of ${params.length} bytes)`;
  }

  const isPrimitive = !isObject(params);
  if (isPrimitive) {
    return params;
  }
  const isArray = Array.isArray(params);
  if (isArray) {
    return params.map((x) => unroll(x));
  }

  return Object.keys(params).reduce(
    (all, key) => ({
      ...all,
      [key]: unroll(params[key]),
    }),
    {},
  );
}

function createHexView(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  const hexArray = Array.from(view, (byte) =>
    byte.toString(16).padStart(2, "0"),
  );
  // Prepare offset labels for each line
  const offsetLabels: Array<string> = [];
  for (let i = 0; i < view.length; i += 16) {
    const from = i;
    const to = Math.min(i + 15, view.length - 1);
    offsetLabels.push(
      `${from.toString().padStart(4, "0")}-${to.toString().padStart(4, "0")}`,
    );
  }
  // First columns are hex values, 16 bytes per line
  const hexLines: Array<string> = [];
  for (let i = 0; i < hexArray.length; i += 16) {
    const line = hexArray.slice(i, i + 16).join(" ");
    hexLines.push(line);
  }

  // Add ASCII representation as a second column
  for (let i = 0; i < view.length; i += 16) {
    const hex = hexArray.slice(i, i + 16).join(" ");
    const ascii = Array.from(view.slice(i, i + 16))
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");
    hexLines[i / 16] = `${offsetLabels[i / 16]}: ${hex.padEnd(47)}  |${ascii}|`;
  }
  return hexLines.join("\n");
}
