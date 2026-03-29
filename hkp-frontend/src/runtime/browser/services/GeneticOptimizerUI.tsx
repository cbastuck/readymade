import React, { Component } from "react";

import ServiceUI from "../../services/ServiceUI";
import Annotations from "../../../components/shared/Annotations";

type GeneticOptimizerUIState = {
  ttl?: number;
  dataRoot?: string;
  annotations?: Record<string, string>;
};

export default class GeneticOptimizerUI extends Component<any, GeneticOptimizerUIState> {
  state: GeneticOptimizerUIState = {};

  onInit(initialState: { ttl?: number; dataRoot?: string; annotations?: Record<string, string> }): void {
    const { ttl, dataRoot, annotations = {} } = initialState;
    this.setState({
      ttl,
      dataRoot,
      annotations,
    });
  }

  renderMain = (service: any): JSX.Element => {
    const vspace = { marginBottom: 5 };
    return (
      <div style={{ textAlign: "left" }}>
        <input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={this.state.dataRoot || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const dataRoot = e.target.value;
            this.setState({ dataRoot });
            service.dataRoot = dataRoot;
          }}
        />
        <input
          style={{ ...vspace, width: "100%" }}
          type="number"
          value={this.state.ttl || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ ttl: Number(e.target.value) })}
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
            e.key === "Enter" &&
            service.configure({ ttl: Number(this.state.ttl) })
          }
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

  renderAnnotations = (service: any): JSX.Element => {
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

  render(): JSX.Element {
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
