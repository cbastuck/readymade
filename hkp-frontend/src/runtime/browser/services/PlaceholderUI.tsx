import { Component } from "react";

import InputField from "../../../components/shared/InputField";
import { isFunction, filterPrivateMembers } from "./helpers";
import { ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";

type State = {
  properties: { [key: string]: any };
};

export default class PlaceholderUI extends Component<ServiceUIProps, State> {
  state: State = {
    properties: {},
  };

  extractProperties = (config: any) => {
    if (!config) {
      return {};
    }
    const additionalFiters = ["uuid", "board"];
    return Object.keys(filterPrivateMembers(config))
      .filter((x) => additionalFiters.indexOf(x) === -1)
      .filter((x) => !isFunction(config[x]))
      .reduce((all, key) => {
        const val = config[key];
        const t = typeof val;
        return {
          ...all,
          [key]: t === "object" ? JSON.stringify(val) : val,
        };
      }, {});
  };

  onInit = (initialState: any) => {
    this.setState({ properties: this.extractProperties(initialState) });
  };

  onNotification = (notification: any) => {
    const { properties } = this.state;
    this.setState({
      properties: {
        ...properties,
        ...this.extractProperties(notification),
      },
    });
  };

  renderMain = () => {
    const { properties } = this.state;
    const { service } = this.props;
    return (
      <div key={service.uuid} id={service.uuid} style={{ minWidth: 200 }}>
        {Object.keys(properties).map((prop) => {
          const val = properties[prop];
          const t = typeof val;
          return (
            <InputField
              key={`PlaceholderUI-${service.uuid}.${prop}`}
              label={prop}
              labelStyle={{ textTransform: "none" }}
              value={val}
              onChange={(value) => service.configure({ [prop]: value })}
              disabled={true}
            />
          );
        })}
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        className="pb-2"
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {this.renderMain()}
      </ServiceUI>
    );
  }
}
