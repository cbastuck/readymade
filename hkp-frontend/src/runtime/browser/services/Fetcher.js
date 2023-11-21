import { Component } from "react";

import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/fetcher";
const serviceName = "Fetcher";

export class FetcherUI extends Component {
  onInit(initialState) {
    this.setState({
      ...initialState,
    });
  }

  renderMain = () => {
    return <div />;
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[{ name: "Main", render: this.renderMain }]}
      />
    );
  }
}

class Fetcher {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async configure() {}

  async process(params) {
    const { url, method = "get", body, headers } = params;
    if (!url) {
      console.warn("Fetcher no url incoming", params);
      return params;
    }

    try {
      const res = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers,
      });
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
