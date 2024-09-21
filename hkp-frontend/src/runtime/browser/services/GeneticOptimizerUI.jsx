import React, { Component } from "react";

import ServiceUI from "../../services/ServiceUI";
import Annotations from "../../../components/shared/Annotations";

export default class GeneticOptimizerUI extends Component {
  state = {};

  onInit(initialState) {
    const { ttl, dataRoot, annotations = {} } = initialState;
    this.setState({
      ttl,
      dataRoot,
      annotations,
    });
  }

  renderMain = (service) => {
    const vspace = { marginBottom: 5 };
    return (
      <div style={{ textAlign: "left" }}>
        <input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={this.state.dataRoot || ""}
          onChange={(_, { value: dataRoot }) => {
            this.setState({ dataRoot });
            service.dataRoot = dataRoot;
          }}
          label="Root"
        />
        <input
          style={{ ...vspace, width: "100%" }}
          type="number"
          value={this.state.ttl || ""}
          onChange={(_, { value }) => this.setState({ ttl: value })}
          onKeyPress={(e) =>
            e.key === "Enter" &&
            service.configure({ ttl: Number(this.state.ttl) })
          }
          label="TTL"
        />
        <button
          style={{ ...vspace, width: "100%" }}
          onClick={() =>
            service.configure({
              initialPopulation: service.initialPopulation || [],
            })
          }
        >
          Reset
        </button>
      </div>
    );
  };

  renderAnnotations = (service) => {
    return (
      <Annotations
        service={service}
        initial={this.state.annotations}
        onCommit={(annotations) => {
          this.setState({ annotations });
          service.annotations = annotations;
        }}
      />
    );
  };
  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[
          { name: "main", render: this.renderMain },
          { name: "annotations", render: this.renderAnnotations },
        ]}
      />
    );
  }
}
