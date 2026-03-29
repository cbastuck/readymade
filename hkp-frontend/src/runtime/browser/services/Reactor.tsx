import { JSX } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactDOM from "react-dom/client";

import {
  parseExpression,
  evalExpression,
} from "hkp-frontend/src/runtime/browser/services/base/eval";

const serviceId = "hookup.to/service/reactor";
const serviceName = "Reactor";

type ReactorElement = {
  type: string;
  value?: string;
  "value="?: string;
};

class Reactor {
  uuid: string;
  board: any;
  app: any;
  elements: ReactorElement[];
  template: string | null;
  target: HTMLElement | null | undefined;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.elements = [];
    this.template = null;
  }

  configure(config: { targetId?: string; elements?: ReactorElement[]; template?: string }): void {
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

  getDynamicElement = (exp: string, params: any): any => {
    const parsed = parseExpression(exp);
    return evalExpression(parsed, { params });
  };

  buildlement = (elem: ReactorElement, params: any): JSX.Element => {
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

  buildComponent = (params: any): JSX.Element => {
    return (
      <div>
        {this.elements.map((elem, idx) => (
          <div key={idx}>{this.buildlement(elem, params)}</div>
        ))}
      </div>
    );
  };

  applyToTemplate = (params: any, template: string): string => {
    const param = Array.isArray(params) ? params[0] : params;
    const keys = Object.keys(param);
    return keys.reduce(
      (acc: string, cur: string) => acc.split(`[[${cur}]]`).join(param[cur]),
      template
    );
  };

  process(params: any): string | undefined {
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
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Reactor(app, board, _descriptor, id),
  createUI: undefined,
};

export default descriptor;
