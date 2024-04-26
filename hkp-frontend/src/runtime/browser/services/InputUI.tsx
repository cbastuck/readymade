import { Checkbox } from "semantic-ui-react";

import InputField from "../../../components/shared/InputField";
import Button from "../../../components/shared/Button";

import { s, t } from "../../../styles";
import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import { useState } from "react";

export default function InputUI(props: ServiceUIProps) {
  const [state, setState] = useState({
    url: "",
    topic: "secret-key",
    isWebsocket: false,
    canFetch: undefined,
    running: false,
  });

  const onInit = (initialState: any) => {
    const {
      url = "",
      running = false,
      topic = "secret-key",
      isWebsocket = false,
    } = initialState;
    setState((state) => ({ ...state, url, running, topic, isWebsocket }));
  };

  const onNotification = (_: ServiceInstance, notification: any) => {
    const { url, running, topic, isWebsocket, canFetch } = notification;

    if (needsUpdate(url, state.url)) {
      setState((state) => ({ ...state, url }));
    }

    if (needsUpdate(running, state.running)) {
      setState((state) => ({ ...state, running }));
    }

    if (needsUpdate(topic, state.topic)) {
      setState((state) => ({ ...state, topic }));
    }

    if (needsUpdate(isWebsocket, state.isWebsocket)) {
      setState((state) => ({ ...state, isWebsocket }));
    }

    if (needsUpdate(canFetch, state.canFetch)) {
      setState((state) => ({ ...state, canFetch }));
    }
  };

  const { service } = props;
  const { running, url, topic, isWebsocket, canFetch } = state;
  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      <div
        style={{
          margin: 10,
        }}
      >
        <div style={s(t.ls1, t.fs12)}>
          <InputField
            label="URL"
            value={url}
            onChange={(_, { value: url }) => {
              if (url) {
                setState((state) => ({ ...state, url }));
                service.configure({ url });
              }
            }}
          />
        </div>
        {isWebsocket && (
          <div style={s(t.ls1, t.fs12)}>
            <InputField
              label="topic"
              value={topic}
              onChange={(_, { value: topic }) => {
                setState((state) => ({ ...state, topic }));
                service.configure({ topic });
              }}
            />
          </div>
        )}
        {canFetch === true && (
          <Button
            style={s(t.w100, t.ls1, t.fs12, { marginTop: 0 })}
            onClick={() => service.configure({ fetch: url })}
          >
            Fetch
          </Button>
        )}
        {canFetch === false && (
          <div style={t.tl}>
            <Checkbox
              style={s(t.mt1, t.ls1, t.fs12)}
              label="Input active"
              toggle
              onChange={(_, { checked: running }) => {
                service.configure({ running });
              }}
              checked={running}
            />
          </div>
        )}
      </div>
    </ServiceUI>
  );
}
