import React, { useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Annotations from "../../../components/shared/Annotations";

export default function GeneticOptimizerUI(props: any): JSX.Element {
  const [ttl, setTtl] = useState<number | undefined>(undefined);
  const [dataRoot, setDataRoot] = useState<string | undefined>(undefined);
  const [annotations, setAnnotations] = useState<
    Record<string, string> | undefined
  >(undefined);

  const onInit = (initialState: {
    ttl?: number;
    dataRoot?: string;
    annotations?: Record<string, string>;
  }): void => {
    const {
      ttl: newTtl,
      dataRoot: newDataRoot,
      annotations: newAnnotations = {},
    } = initialState;
    setTtl(newTtl);
    setDataRoot(newDataRoot);
    setAnnotations(newAnnotations);
  };

  const renderMain = (service: any): JSX.Element => {
    const vspace = { marginBottom: 5 };
    return (
      <div style={{ textAlign: "left" }}>
        <input
          style={{ ...vspace, width: "100%" }}
          type="text"
          value={dataRoot || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const newDataRoot = e.target.value;
            setDataRoot(newDataRoot);
            service.dataRoot = newDataRoot;
          }}
        />
        <input
          style={{ ...vspace, width: "100%" }}
          type="number"
          value={ttl || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTtl(Number(e.target.value))
          }
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
            e.key === "Enter" && service.configure({ ttl: Number(ttl) })
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
        { name: "main", render: renderMain },
        { name: "annotations", render: renderAnnotations },
      ]}
    />
  );
}
