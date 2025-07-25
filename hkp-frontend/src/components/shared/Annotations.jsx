import React, { Component } from "react";

import Button from "hkp-frontend/src/ui-components/Button";
import InputLabelValue from "./InputLabelValue";

import "./Annotations.css";

const newAnnotation = { key: "value" };

export default class Annotations extends Component {
  componentDidMount() {
    this.setState({
      annotations: this.props.initial || {},
    });
  }

  render() {
    const { service, onCommit } = this.props;
    const { annotations = {} } = this.state || {};
    return (
      <div className="annotation-header">
        {Object.keys(annotations).map((key, i) => (
          <div
            className="annotations"
            kkey={`container-${service.uuid}-${key}-${i}`}
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
                  {}
                );

                this.setState({ annotations: newAnnotations });
                onCommit(newAnnotations);
              }}
            />
          </div>
        ))}
        <Button
          style={{ marginTop: 1, width: "100%" }}
          onClick={() => {
            this.setState({
              annotations: {
                ...this.state.annotations,
                ...newAnnotation,
              },
            });
          }}
        >
          Add Annotation
        </Button>
      </div>
    );
  }
}
