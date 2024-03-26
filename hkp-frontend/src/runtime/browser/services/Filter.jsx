import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import { s, t } from "hkp-frontend/src/styles";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import ServiceUI from "hkp-frontend/src/runtime/services/ServiceUI";

import FilterDescriptor from "hkp-services/Filter";

export class FilterUI extends Component {
  state = {};

  onInit(initialState) {
    const { conditions, aggregator } = initialState;

    this.setState({
      conditions,
      aggregator,
    });
  }

  onNotification(service, notification) {
    const { conditions, aggregator } = notification;

    if (conditions !== undefined) {
      this.setState({ conditions });
    }

    if (aggregator !== undefined) {
      this.setState({ aggregator });
    }
  }

  renderMain = (service) => {
    const { conditions, aggregator } = this.state;
    return (
      <div className="filter-service" style={{ textAlign: "left" }}>
        {conditions &&
          conditions.map((condition, cidx) => (
            <InputField
              key={`filter-condition-${service.uuuid}-${cidx}`}
              type="text"
              label={`C${cidx + 1}`}
              value={condition || ""}
              labelPosition="left"
              onChange={(_, { value: condition }) => {
                const updated = condition
                  ? conditions.map((c, cci) => (cci === cidx ? condition : c))
                  : conditions.filter((c, cci) => cci !== cidx);
                service.configure({ conditions: updated });
              }}
            />
          ))}
        {conditions && conditions.length > 1 && (
          <SelectorField
            label="Op"
            options={{ and: "and", or: "or" }}
            value={aggregator}
            onChange={(_ev, { value: aggregator }) => {
              service.configure({ aggregator });
            }}
          />
        )}
        <Button
          style={s(t.uc, t.fs12, t.ls1, t.w100)}
          onClick={() => {
            service.configure({ conditions: [...conditions, ""] });
          }}
        >
          Add Condition
        </Button>
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
}

const descriptor = {
  serviceName: FilterDescriptor.serviceName,
  serviceId: FilterDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new FilterDescriptor.service(app, board, descriptor, id),
  //new Filter(app, board, descriptor, id),
  createUI: FilterUI,
};

export default descriptor;
