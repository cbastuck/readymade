import { ServiceInstance, ServiceUIProps } from "@/types";

import { TextArea } from "semantic-ui-react";

import Editor from "hkp-frontend/src/components/shared/Editor/index";
import { Button } from "hkp-frontend/src/components/ui/button";

import ServiceUI from "hkp-frontend/src/runtime/services/ServiceUI";

import { s, t } from "hkp-frontend/src/styles";
import { useState } from "react";
import { needsUpdate } from "@/ui-components/service/ServiceUI";

const ACTION_BAR_HEIGHT = "45";

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
    }

    setMessage(isObject(s) ? JSON.stringify(s, null, 2) : s);
  };

  const clearEditor = () => setMessage("");

  const switchEditor = () => setRenderTextEditor(!renderTextEditor);

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
      <div
        style={s(t.m("5px 10px"), {
          height: `calc(100% - ${ACTION_BAR_HEIGHT}px)`,
        })}
      >
        <Editor
          value={message}
          language="json"
          onChange={(val) => val && setMessage(val)}
        />
      </div>
    );

  const renderActionBar = (service: ServiceInstance) => (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        margin: "0px 10px",
        marginBottom: 5,
        height: `${ACTION_BAR_HEIGHT} - 15}px`,
      }}
    >
      <Button variant="outline" onClick={clearEditor} style={{ width: "100%" }}>
        Clear
      </Button>

      <Button
        variant="outline"
        onClick={switchEditor}
        style={{ width: "100%" }}
      >
        {renderTextEditor ? "Edit" : "Back"}
      </Button>
      <Button
        variant="outline"
        style={{ width: "100%" }}
        onClick={() => {
          let data;
          try {
            data = JSON.parse(message);
          } catch (err) {
            data = message;
          }
          service.app.next(service, data);
        }}
      >
        Inject
      </Button>
    </div>
  );

  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      {({ service }: { service: ServiceInstance }) =>
        service && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderEditor()}
            {renderActionBar(service)}
          </div>
        )
      }
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
