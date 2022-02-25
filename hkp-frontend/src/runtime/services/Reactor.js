import React from "react";
import ReactDOM from "react-dom";

const { parseExpression, evalExpression } = require("services/eval");

const serviceId = "hookup.to/service/reactor";
const serviceName = "Reactor";

class Reactor {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.elements = [];
  }

  configure(config) {
    const { targetId, elements } = config;

    if (targetId !== undefined) {
      this.target = document.getElementById(targetId);
    }

    if (elements !== undefined) {
      this.elements = elements;
    }
  }

  getDynamicElement = (exp, params) => {
    const parsed = parseExpression(exp);
    return evalExpression(parsed, { params });
  };

  buildlement = (elem, params) => {
    const { type, value } = elem;
    const dynamicValue = elem["value="];
    switch (type) {
      case "text":
        return dynamicValue ? (
          <div>{this.getDynamicElement(dynamicValue, params)}</div>
        ) : (
          <div> {value} </div>
        );
      default:
        return <div>Unknown element: {type}</div>;
    }
  };

  buildComponent = (params) => {
    return (
      <div>
        {this.elements.map((elem, idx) => (
          <div key={idx}>{this.buildlement(elem, params)}</div>
        ))}
      </div>
    );
  };

  process(params) {
    if (this.target) {
      ReactDOM.render(this.buildComponent(params), this.target);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Reactor(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;
