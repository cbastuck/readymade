import { useState } from "react";

import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/fetcher";
const serviceName = "Fetcher";

export function FetcherUI(props) {
  const idleState = "Idle";
  const [status, setStatus] = useState(idleState);
  const onInit = ({ status: initStatus }) => {
    if (initStatus !== undefined) {
      setStatus(initStatus || idleState);
    }
  };

  const onNotification = (notification) => {
    const { status: statusUpdate } = notification;
    if (statusUpdate !== undefined) {
      setStatus(statusUpdate || idleState);
    }
  };

  const renderMain = () => {
    return (
      <div
        style={{ width: "100%", textAlign: "left", textOverflow: "ellipsis" }}
      >
        Status: {status}
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit.bind(this)}
      onNotification={onNotification}
      segments={[{ name: "Main", render: renderMain }]}
    />
  );
}

class Fetcher {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    this.status = null;
  }

  async configure() {}

  async process(params) {
    const { url, method = "get", body, headers } = params;
    if (!url) {
      console.warn("Fetcher no url incoming", params);
      return params;
    }

    this.app.notify(this, { status: `fetch ${url}` });
    try {
      const res = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers,
      });
      this.app.notify(this, { status: null });
      const contentType = res.headers.get("content-type");
      switch (contentType) {
        case "application/json":
          return await res.json();
        case "plain/text":
          return await res.text();
        default:
          const blob = await res.blob();
          return blob;
      }
    } catch (err) {
      this.app.notify(this, { status: err.message });
      console.error("Fetcher caught error", err);
      return null;
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Fetcher(app, board, descriptor, id),
  createUI: FetcherUI,
};

export default descriptor;
