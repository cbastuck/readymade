import { useState } from "react";
import { Checkbox, Label } from "semantic-ui-react";

import { AppImpl, ServiceClass, ServiceImpl } from "../../../types";
import ServiceUI from "../../services/ServiceUI";
import HtmlConfigTree, { TreeConfig } from "./HtmlConfigTree";

const serviceId = "hookup.to/service/html";
const serviceName = "Html";

function HtmlUI(props: any) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlDocument, setHtmlDocument] = useState("");
  const [treeConfig, setTreeConfig] = useState<TreeConfig>([]);

  const updateState = (cfg: any) => {
    const { fullscreen, html, config } = cfg;
    if (fullscreen !== undefined) {
      setIsFullscreen(fullscreen);
    }

    if (html !== undefined) {
      setHtmlDocument(html);
    }

    if (config !== undefined) {
      setTreeConfig(config);
    }
  };

  const onInit = (config: any) => {
    updateState(config);
  };

  const onNotification = (service: Html, notification: any) => {
    updateState(notification);

    if (notification.html && service.fullscreen) {
      document.body.innerHTML = notification.html;
    }
  };

  const configView = {
    name: "config",
    render: (service: ServiceImpl) => {
      return (
        <div
          style={{
            minWidth: "350px",
            width: "100%",
            height: "100%",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              height: "200px",
              width: "100%",
              border: "solid 1px lightgray",
            }}
          >
            <HtmlConfigTree
              data={treeConfig}
              onChange={(cfg) => service.configure({ config: cfg })}
            />
          </div>

          <div style={{ marginTop: 5 }}>
            <Checkbox
              label="Fullscreen"
              checked={isFullscreen}
              onChange={async (_, { checked }) => {
                service.configure({
                  fullscreen: checked,
                });
              }}
              toggle
            />
          </div>
        </div>
      );
    },
  };

  const renderView = {
    name: "document",
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
        }}
      >
        <div id="html-service" style={{ margin: "20px 100px" }}>
          {htmlDocument ? (
            <div dangerouslySetInnerHTML={{ __html: htmlDocument }} />
          ) : (
            "Render Area"
          )}
        </div>
      </div>
    ),
  };
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[renderView, configView]}
    />
  );
}

class Html {
  uuid: string;
  board: string;
  app: AppImpl;

  fullscreen: boolean = false;
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

    this.fullscreen = false;
  }

  async destroy() {}

  async configure(cfg: any) {
    const { fullscreen, config } = cfg || {};

    if (fullscreen !== undefined) {
      this.fullscreen = fullscreen;
      this.app.notify(this, { fullscreen });
    }

    if (config !== undefined) {
      this.config = config;
      this.app.notify(this, { config });
    }
  }

  async process(params: any) {
    const children = processConfig(this.config, params);

    const html = `
      <div style="padding: 10px;">
        ${children}
      </div>`;
    this.app.notify(this, { html });
    return html;
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
    new Html(app, board, descriptor, id),
  createUI: HtmlUI,
};

export default descriptor;
