import { useState } from "react";
import { TextArea } from "semantic-ui-react";

import { AppImpl, ServiceClass, ServiceImpl } from "../../../types";
import ServiceUI from "../../services/ServiceUI";
import HtmlConfigTree, { TreeConfig } from "./HtmlConfigTree";

const serviceId = "hookup.to/service/array-transform";
const serviceName = "Array Transform";

function ArrayTransformUI(props: any) {
  const [transformedData, setTransformedData] = useState("");
  const [treeConfig, setTreeConfig] = useState<TreeConfig>([]);

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

  const onNotification = (service: ArrayTransform, notification: any) => {
    updateState(notification);
  };

  const configView = {
    name: "config",
    render: (service: ServiceImpl) => {
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
            onChange={(cfg) => service.configure({ config: cfg })}
          />
        </div>
      );
    },
  };

  const renderView = {
    name: "Output",
    render: (service: ServiceImpl) => (
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
        <TextArea
          style={{
            height: "100%",
            width: "100%",
            border: "none",
            resize: "none",
          }}
          value={transformedData}
        />
      </div>
    ),
  };
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[configView, renderView]}
    />
  );
}

class ArrayTransform {
  uuid: string;
  board: string;
  app: AppImpl;

  config = [];

  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async destroy() {}

  async configure(cfg: any) {
    const { config } = cfg || {};

    if (config !== undefined) {
      this.config = config;
      this.app.notify(this, { config });
    }
  }

  async process(params: any) {
    const data = processConfig(this.config, params);
    this.app.notify(this, { data });
    return data;
  }
}

function replaceParamsInString(params: any, src: string) {
  const keys = Object.keys(params);
  const replaced = keys.reduce(
    (acc, cur) => acc.split(`[[${cur}]]`).join(params[cur]),
    src
  );
  return replaced;
}

export function processConfig(cfg: any, params: any): string {
  if (Array.isArray(cfg)) {
    const children = cfg.map((c) => processConfig(c, params)).join("");
    return replaceParamsInString(params, children);
  }

  const { html, children } = cfg;
  return Array.isArray(params)
    ? params
        .map((param) => {
          const childContent = children
            ? processConfig(children, param)
            : undefined;
          return replaceParamsInString(
            { ...param, children: childContent },
            html
          );
        })
        .join("")
    : replaceParamsInString(
        {
          ...params,
          children: children ? processConfig(children, params) : undefined,
        },
        html
      );
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new ArrayTransform(app, board, descriptor, id),
  createUI: ArrayTransformUI,
};

export default descriptor;
