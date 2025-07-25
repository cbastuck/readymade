import { useState } from "react";
import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";

import { ServiceInstance } from "../../../types";

import HtmlConfigTree, { TreeConfig } from "./HtmlConfigTree";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

export default function ArrayTransformUI(props: any) {
  const [transformedData, setTransformedData] = useState("");
  const [treeConfig, setTreeConfig] = useState<TreeConfig>([]);
  const [mode, setMode] = useState("config");

  const updateState = (cfg: any) => {
    const { data, config } = cfg;

    if (data !== undefined) {
      setTransformedData(data);
    }

    if (config !== undefined) {
      setTreeConfig(config);
    }
  };

  const onInit = (config: any) => {
    updateState(config);
  };

  const onNotification = (notification: any) => {
    updateState(notification);
  };

  const configView = (service: ServiceInstance) => {
    return (
      <div
        style={{
          minWidth: "350px",
          width: "100%",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          border: "solid 1px lightgray",
        }}
      >
        <HtmlConfigTree
          data={treeConfig}
          onChange={(cfg) => service.configure?.({ config: cfg })}
        />
      </div>
    );
  };

  const renderView = (_service: ServiceInstance) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        maxHeight: "400px",
        overflow: "auto",
        textAlign: "left",
        border: "solid 1px lightgray",
        marginTop: 5,
        color: "lightgray",
        padding: 5,
        overflowY: "hidden",
      }}
    >
      <Textarea
        style={{
          height: "100%",
          width: "100%",
          border: "none",
          resize: "none",
        }}
        value={transformedData}
        readOnly
      />
    </div>
  );

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 400, height: undefined }}
      className="pb-4"
      onInit={onInit}
      onNotification={onNotification}
    >
      <RadioGroup
        title="Mode"
        options={["config", "render"]}
        value={mode}
        onChange={setMode}
      />
      {mode === "render"
        ? renderView(props.service)
        : configView(props.service)}
    </ServiceUI>
  );
}
