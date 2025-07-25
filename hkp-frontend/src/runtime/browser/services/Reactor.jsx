import { renderToStaticMarkup } from "react-dom/server";
import ReactDOM from "react-dom/client";

import {
  parseExpression,
  evalExpression,
} from "hkp-frontend/src/runtime/browser/services/base/eval";

const serviceId = "hookup.to/service/reactor";
const serviceName = "Reactor";

class Reactor {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.elements = [];
    this.template = null;
  }

  configure(config) {
    const { targetId, elements, template } = config;

    if (targetId !== undefined) {
      this.target = document.getElementById(targetId);
    }

    if (elements !== undefined) {
      this.elements = elements;
    }

    if (template !== undefined) {
      this.template = template;
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

  applyToTemplate = (params, template) => {
    const param = Array.isArray(params) ? params[0] : params;
    const keys = Object.keys(param);
    return keys.reduce(
      (acc, cur) => acc.split(`[[${cur}]]`).join(param[cur]),
      template
    );
  };

  process(params) {
    if (this.target) {
      const C = () => this.buildComponent(params);
      ReactDOM.createRoot(this.target).render(<C />);
    } else if (this.template !== null) {
      return this.applyToTemplate(params, this.template);
    } else {
      return renderToStaticMarkup(this.buildComponent(params));
    }
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
