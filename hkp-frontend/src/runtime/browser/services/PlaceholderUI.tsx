import { useState } from "react";

import InputField from "../../../components/shared/InputField";
import { isFunction, filterPrivateMembers } from "./helpers";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

type State = {
  properties: { [key: string]: any };
};

export default function PlaceholderUI(props: ServiceUIProps) {
  const [state, setState] = useState<State>({ properties: {} });

  const extractProperties = (config: any) => {
    if (!config) {
      return {};
    }
    const additionalFiters = ["uuid", "board", "bypass"];
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

  const onInit = (initialState: any) => {
    const initialProps = extractProperties(initialState);
    setState({ properties: initialProps });
  };

  const onNotification = (notification: any) => {
    if (notification?.properties !== undefined) {
      setState({
        properties: {
          ...extractProperties(notification),
        },
      });
    }
  };

  const { service } = props;
  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      <div key={service.uuid} id={service.uuid} style={{ minWidth: 200 }}>
        {Object.keys(state.properties).map((prop) => {
          const val = state.properties[prop];
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
    </ServiceUI>
  );
}
