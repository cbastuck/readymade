import React, { useState } from "react";
import jstat from "jstat";

import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
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

function SamplingUI(props: any): JSX.Element {
  const [wrapSample, setWrapSample] = useState<boolean>(false);
  const [mean, setMean] = useState<string | undefined>(undefined);
  const [std, setStd] = useState<string | undefined>(undefined);
  const [annotations, setAnnotations] = useState<Record<string, string> | undefined>(undefined);
  const [root, setRoot] = useState<string | undefined>(undefined);

  const onInit = (initialState: { mean?: number[]; std?: number[]; annotations?: Record<string, string>; root?: string }): void => {
    const newState: any = {};
    const { mean: m, std: s, annotations: a, root: r } = initialState;
    if (m !== undefined) {
      newState.mean = JSON.stringify(m);
    }
    if (s !== undefined) {
      newState.std = JSON.stringify(s);
    }
    if (a !== undefined) {
      newState.annotations = a;
    }
    if (r !== undefined) {
      newState.root = r;
    }

    if (newState.mean !== undefined) setMean(newState.mean);
    if (newState.std !== undefined) setStd(newState.std);
    if (newState.annotations !== undefined) setAnnotations(newState.annotations);
    if (newState.root !== undefined) setRoot(newState.root);
    setWrapSample(!!newState.root);
  };

  const renderModel = (service: any): JSX.Element => {
    const vspace = { marginBottom: 5 };
    return (
      <div>
        <Input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={mean || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMean(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent) =>
            e.key === "Enter" && (service.mean = isJSON(mean ?? ""))
          }
        />
        <Input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={std || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStd(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent) =>
            e.key === "Enter" && (service.std = isJSON(std ?? ""))
          }
        />
      </div>
    );
  };

  const renderWrapping = (service: any): JSX.Element => {
    const vspace = { marginBottom: 5 };
    return (
      <div style={{ margin: "10px 0px", textAlign: "left" }}>
        <Checkbox
          checked={wrapSample}
          onCheckedChange={(checked: boolean) => {
            const newRoot = !checked ? undefined : root;
            service.root = newRoot;
            setWrapSample(checked);
            setRoot(newRoot);
          }}
        />
        <Input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={root || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoot(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent) =>
            e.key === "Enter" && (service.root = root)
          }
        />
      </div>
    );
  };

  const renderAnnotations = (service: any): JSX.Element => {
    return (
      <Annotations
        service={service}
        initial={annotations}
        onCommit={(newAnnotations) => {
          setAnnotations(newAnnotations);
          service.annotations = newAnnotations;
        }}
      />
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      segments={[
        { name: "model", render: renderModel },
        { name: "wrapping", render: renderWrapping },
        { name: "annotate", render: renderAnnotations },
      ]}
    />
  );
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
