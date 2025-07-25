import { Component } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";

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
        <GroupLabel>Conditions</GroupLabel>
        {conditions &&
          conditions.map((condition: any, cidx: number) => (
            <InputField
              key={`filter-condition-${service.uuuid}-${cidx}`}
              className="font-menu"
              type="text"
              label={`${cidx + 1}`}
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
        <Button
          className="my-2 w-full"
          onClick={() => {
            service.configure({ conditions: [...conditions, ""] });
          }}
        >
          Add Condition
        </Button>
        {conditions && conditions.length > 1 && (
          <SelectorField
            className="my-2 mx-0"
            label="Operation"
            options={{ and: "AND", or: "OR" }}
            value={aggregator}
            onChange={({ value: aggregator }) => {
              service.configure({ aggregator });
            }}
          />
        )}
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        initialSize={{ width: 300, height: undefined }}
      >
        {this.renderMain()}
      </ServiceUI>
    );
  }
}
