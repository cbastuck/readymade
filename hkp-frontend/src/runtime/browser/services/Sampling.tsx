import React, { Component } from "react";
import jstat from "jstat";

import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";
import ServiceUI from "../../services/ServiceUI";
import Annotations from "../../../components/shared/Annotations";

const serviceId = "hookup.to/service/sampling";
const serviceName = "Sampling";

function isJSON(x: string): any {
  try {
    return JSON.parse(x);
  } catch (err) {
    return undefined;
  }
}

type SamplingUIState = {
  wrapSample: boolean;
  mean?: string;
  std?: string;
  annotations?: Record<string, string>;
  root?: string;
};

class SamplingUI extends Component<any, SamplingUIState> {
  state: SamplingUIState = {
    wrapSample: false,
  };

  onInit(initialState: { mean?: number[]; std?: number[]; annotations?: Record<string, string>; root?: string }): void {
    const newState: Partial<SamplingUIState> = {};
    const { mean, std, annotations, root } = initialState;
    if (mean !== undefined) {
      newState.mean = JSON.stringify(mean);
    }
    if (std !== undefined) {
      newState.std = JSON.stringify(std);
    }
    if (annotations !== undefined) {
      newState.annotations = annotations;
    }
    if (root !== undefined) {
      newState.root = root;
    }

    this.setState({
      ...newState,
      wrapSample: !!newState.root,
    } as SamplingUIState);
  }

  renderModel = (service: any): JSX.Element => {
    const vspace = { marginBottom: 5 };
    return (
      <div>
        <Input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={this.state.mean || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ mean: e.target.value })}
          onKeyPress={(e: React.KeyboardEvent) =>
            e.key === "Enter" && (service.mean = isJSON(this.state.mean ?? ""))
          }
        />
        <Input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={this.state.std || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ std: e.target.value })}
          onKeyPress={(e: React.KeyboardEvent) =>
            e.key === "Enter" && (service.std = isJSON(this.state.std ?? ""))
          }
        />
      </div>
    );
  };

  renderWrapping = (service: any): JSX.Element => {
    const vspace = { marginBottom: 5 };
    return (
      <div style={{ margin: "10px 0px", textAlign: "left" }}>
        <Checkbox
          checked={this.state.wrapSample}
          onCheckedChange={(checked: boolean) => {
            const root = !checked ? undefined : this.state.root;
            service.root = root;
            this.setState({ wrapSample: checked, root });
          }}
        />
        <Input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={this.state.root || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ root: e.target.value })}
          onKeyPress={(e: React.KeyboardEvent) =>
            e.key === "Enter" && (service.root = this.state.root)
          }
        />
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
          { name: "model", render: this.renderModel },
          { name: "wrapping", render: this.renderWrapping },
          { name: "annotate", render: this.renderAnnotations },
        ]}
      />
    );
  }
}

class Sampling {
  uuid: string;
  board: any;
  app: any;
  mean: number[];
  std: number[];
  annotations?: Record<string, string>;
  root?: string;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.mean = [0.5, 0.5];
    this.std = [0.1, 0.1];
    this.annotations = undefined;
    this.root = undefined;
  }

  configure(config: { mean?: number[]; std?: number[]; annotations?: Record<string, string>; root?: string }): void {
    const { mean, std, annotations, root } = config;
    if (mean !== undefined) {
      this.mean = mean;
    }

    if (std !== undefined) {
      this.std = std;
    }

    if (annotations !== undefined) {
      this.annotations = annotations;
    }

    if (root !== undefined) {
      this.root = root;
    }
  }

  sample(mx: number, sx: number): number {
    return jstat.normal.sample(mx, sx);
  }

  process(params: any): any {
    if (!this.mean || !this.std) {
      return params;
    }

    const n = this.mean.length;
    if (n !== this.std.length) {
      return params;
    }

    const sample = new Array(n)
      .fill(0)
      .map((_, idx) => this.sample(this.mean[idx], this.std[idx]));

    // wrap sample in object in case root or annotations are specified
    const result = this.annotations
      ? { ...this.annotations, [this.root || "sample"]: sample }
      : this.root
      ? { [this.root]: sample }
      : sample;

    if (!params) {
      return result;
    }

    if (Array.isArray(params)) {
      return [...params, result];
    }

    return [params, result];
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Sampling(app, board, _descriptor, id),
  createUI: SamplingUI,
};

export default descriptor;
