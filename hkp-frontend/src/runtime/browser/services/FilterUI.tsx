import { Component } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

import { ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";
import Button from "@/ui-components/Button";

type State = {
  conditions: any;
  aggregator: any;
};

export default class FilterUI extends Component<ServiceUIProps, State> {
  state: State = {
    conditions: undefined,
    aggregator: undefined,
  };

  onInit(initialState: any) {
    const { conditions, aggregator } = initialState;

    this.setState({
      conditions,
      aggregator,
    });
  }

  onNotification(notification: any) {
    const { conditions, aggregator } = notification;

    if (conditions !== undefined) {
      this.setState({ conditions });
    }

    if (aggregator !== undefined) {
      this.setState({ aggregator });
    }
  }

  renderMain = () => {
    const { conditions, aggregator } = this.state;
    const { service } = this.props;
    return (
      <div className="filter-service" style={{ textAlign: "left" }}>
        {conditions &&
          conditions.map((condition: any, cidx: number) => (
            <InputField
              key={`filter-condition-${service.uuuid}-${cidx}`}
              type="text"
              label={`C${cidx + 1}`}
              value={condition || ""}
              onChange={(condition) => {
                const updated = condition
                  ? conditions.map((c: any, cci: number) =>
                      cci === cidx ? condition : c
                    )
                  : conditions.filter((_: any, cci: number) => cci !== cidx);
                service.configure({ conditions: updated });
              }}
            />
          ))}
        {conditions && conditions.length > 1 && (
          <SelectorField
            label="Op"
            options={{ and: "and", or: "or" }}
            value={aggregator}
            onChange={({ value: aggregator }) => {
              service.configure({ aggregator });
            }}
          />
        )}
        <Button
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
      >
        {this.renderMain()}
      </ServiceUI>
    );
  }
}
