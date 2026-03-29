import { useState, useEffect } from "react";

import Button from "hkp-frontend/src/ui-components/Button";
import InputLabelValue from "./InputLabelValue";

import "./Annotations.css";

type AnnotationMap = Record<string, string>;

type Props = {
  service: { uuid: string };
  initial?: AnnotationMap;
  onCommit: (annotations: AnnotationMap) => void;
};

const newAnnotation: AnnotationMap = { key: "value" };

export default function Annotations({ service, initial, onCommit }: Props): JSX.Element {
  const [annotations, setAnnotations] = useState<AnnotationMap>(initial || {});

  useEffect(() => {
    setAnnotations(initial || {});
  }, [initial]);

  return (
    <div className="annotation-header">
      {Object.keys(annotations).map((key, i) => (
        <div
          className="annotations"
          key={`container-${service.uuid}-${key}-${i}`}
        >
          <InputLabelValue
            key={`input-${service.uuid}-${key}-${i}`}
            value={annotations[key]}
            label={key}
            labelPosition="left"
            onCommit={({ label: newKey, value }) => {
              const newAnnotations = Object.keys(annotations).reduce(
                (all, cur) =>
                  cur !== key
                    ? { ...all, [cur]: annotations[cur] } // this is the input that changed
                    : newKey !== ""
                    ? { ...all, [newKey]: value }
                    : all, // empty key means deleting the item
                {} as AnnotationMap
              );

              setAnnotations(newAnnotations);
              onCommit(newAnnotations);
            }}
          />
        </div>
      ))}
      <Button
        style={{ marginTop: 1, width: "100%" }}
        onClick={() => {
          setAnnotations({
            ...annotations,
            ...newAnnotation,
          });
        }}
      >
        Add Annotation
      </Button>
    </div>
  );
}
