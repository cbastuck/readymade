import React, { Component } from "react";

import ReferenceTemplate from "./ReferenceTemplate";

import { s, t } from "../styles";

export default class DataModelReference extends Component {
  renderProp = (key, decription) => {
    return (
      <div key={`datamodel-property-${key}`}>
        <span style={{ color: "#4183c4" }}>{key}</span>:
        <span>{` ${decription}`}</span>
      </div>
    );
  };

  renderFetched = (name, data) => {
    if (!data) {
      return false;
    }
    const { properties } = data;
    return (
      <div style={s(t.tl, t.fs13)}>
        Properties of the data-model: <span style={t.bold}>{name}</span>
        <div style={s(t.fill, t.fs12, t.nc, t.m(0, 10))}>
          {Object.keys(properties).map((key) =>
            this.renderProp(key, properties[key])
          )}
        </div>
      </div>
    );
  };

  render() {
    const { datamodel, name = datamodel } = this.props;
    return (
      <ReferenceTemplate
        name={name}
        url={`/datamodelDocs/${datamodel}.json`}
        renderFetched={(data) => this.renderFetched(name, data)}
      />
    );
  }
}
