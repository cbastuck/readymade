import { useState } from "react";
import { TextArea } from "semantic-ui-react";
import { CircleX, SquarePlay, Pencil } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "@/types";
import Editor from "hkp-frontend/src/components/shared/Editor/index";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import MenuIcon from "@/ui-components/MenuIcon";

export default function MonitorUI(props: ServiceUIProps) {
  const [message, setMessage] = useState("");
  const [renderTextEditor, setRenderTextEditor] = useState(true);

  const onInit = (state: any) => {
    if (needsUpdate(state.message, message)) {
      setMessage(state.message);
    }
    if (needsUpdate(state.renderTextEditor, renderTextEditor)) {
      setRenderTextEditor(state.renderTextEditor);
    }
  };

  const onNotification = (_: ServiceInstance, params: any) => {
    const nil = params === null && "<null>";
    const undef = params === undefined && "<undefined>";
    const s = nil || undef || unroll(params);

    const { bypass } = params || {};
    if (bypass !== undefined) {
      return;
    } else {
      setMessage(isObject(s) ? JSON.stringify(s, null, 2) : s);
    }
  };

  const switchEditor = () => setRenderTextEditor(!renderTextEditor);

  const clearEditor = () => setMessage("");

  const { service } = props;
  const customMenuEntries = [
    {
      name: "Clear Buffer",
      icon: <MenuIcon icon={CircleX} />,
      onClick: clearEditor,
    },
    {
      name: "Edit Buffer",
      icon: <MenuIcon icon={Pencil} />,
      onClick: switchEditor,
    },
    {
      name: "Inject Buffer",
      icon: <MenuIcon icon={SquarePlay} />,
      onClick: () => {
        let data;
        try {
          data = JSON.parse(message);
        } catch (err) {
          data = message;
        }
        service.app.next(service, data);
      },
    },
  ];

  const renderEditor = () =>
    renderTextEditor ? (
      <TextArea
        style={{
          margin: "5px 10px",
          fontFamily: "monospace",
          fontWeight: "bold",
          resize: "none",
          border: "1px solid lightgray",
          borderRadius: 5,
          flexGrow: 1,
        }}
        value={message}
        rows={10}
        cols={30}
      />
    ) : (
      <Editor
        value={message}
        language="json"
        onChange={(val) => val && setMessage(val)}
      />
    );

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
    >
      <div
        className="pb-2"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {renderEditor()}
      </div>
    </ServiceUI>
  );
}

function isObject(obj: any) {
  return typeof obj === "object" && obj !== null;
}

function unroll(params: any): any {
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
    {}
  );
}
