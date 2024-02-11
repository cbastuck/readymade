import { useState } from "react";
import { Checkbox } from "semantic-ui-react";

import { AppImpl, ServiceClass, ServiceImpl } from "../../../types";
import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/html";
const serviceName = "Html";

function HtmlUI(props: any) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlDocument, setHtmlDocument] = useState("");

  const updateState = (cfg: any) => {
    const { fullscreen, html } = cfg;
    if (fullscreen !== undefined) {
      setIsFullscreen(fullscreen);
    }

    if (html !== undefined) {
      setHtmlDocument(html);
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

  const renderView = {
    name: "document",
    render: (service: ServiceImpl) => (
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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

        <div style={{ textAlign: "left" }}>
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
    ),
  };
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[renderView]}
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
    const html = `
      <div style="padding: 10px;">
        ${params}
      </div>`;
    this.app.notify(this, { html });
    return html;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new Html(app, board, descriptor, id),
  createUI: HtmlUI,
};

export default descriptor;
