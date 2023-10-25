import React, { Component } from "react";

import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/file-source";
const serviceName = "File Source";

class FileSourceUI extends Component {
  state = {};

  renderMain = (service) => {
    return (
      <div
        style={{
          margin: "0px 5px",
          textAlign: "left",
        }}
      >
        <input
          type="file"
          onChange={(ev) => service.loadFiles(ev.target.files)}
          multiple
        />
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        segments={[{ name: "Main", render: this.renderMain }]}
      />
    );
  }
}

class FileSource {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {}

  async loadFile(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.addEventListener("load", (event) => {
          resolve(event.target.result);
        });
        //reader.readAsArrayBuffer(file);
        reader.readAsText(file);
      } catch (err) {
        reject(err);
      }
    });
  }

  async loadFiles(fileList) {
    const r = [];
    for (const file of fileList) {
      r.push(await this.loadFile(file));
    }
    await this.app.next(this, r.length === 1 ? r[0] : r);
  }

  process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new FileSource(app, board, descriptor, id),
  createUI: FileSourceUI,
};

export default descriptor;
