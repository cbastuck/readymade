import { Component } from "react";
import { TextArea, Button } from "semantic-ui-react";

import { MonitorDescriptor } from "hkp-services";

import Editor from "../../../components/shared/Editor/index";
import { s, t } from "../../../styles";
import ServiceUI from "../../services/ServiceUI";

export class MonitorUI extends Component {
  state = {
    message: "",
    renderTextEditor: true,
  };

  onInit = (initialState) => {
    this.setState({
      ...initialState,
    });
  };

  onNotification = (service, params) => {
    const nil = params === null && "<null>";
    const undef = params === undefined && "<undefined>";
    const s = nil || undef || unroll(params);

    const { bypass } = params || {};
    if (bypass !== undefined) {
      return;
    }

    this.setState({
      message: isObject(s) ? JSON.stringify(s, null, 2) : s,
    });
  };

  clearEditor = () => this.setState({ message: "" });

  switchEditor = () =>
    this.setState({ renderTextEditor: !this.state.renderTextEditor });

  renderEditor = () =>
    this.state.renderTextEditor ? (
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
        value={this.state.message}
        rows={10}
        cols={30}
      />
    ) : (
      <div style={s(t.m("5px 10px"), t.h100)}>
        <Editor value={this.state.message} language="json" />
      </div>
    );

  renderActionBar = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        margin: "0px 10px",
        marginBottom: 5,
      }}
    >
      <Button style={s(t.uc, t.ls1, t.fs12, t.w100)} onClick={this.clearEditor}>
        Clear
      </Button>

      <Button
        style={s(t.uc, t.ls1, t.fs12, t.w100)}
        onClick={this.switchEditor}
      >
        {this.state.renderTextEditor ? "Edit" : "Back"}
      </Button>
    </div>
  );

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {({ service }) =>
          service && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {this.renderEditor()}
              {this.renderActionBar()}
            </div>
          )
        }
      </ServiceUI>
    );
  }
}

function isObject(obj) {
  return typeof obj === "object" && obj !== null;
}

function unroll(params) {
  const isBlob = params instanceof Blob;
  if (isBlob) {
    return `Blob (${params.type} ${params.size} bytes)`;
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

const { serviceName, serviceId, service: Monitor } = MonitorDescriptor;
const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Monitor(app, board, descriptor, id),
  createUI: MonitorUI,
};

export default descriptor;
