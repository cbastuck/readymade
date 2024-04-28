import { useState } from "react";

import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import Input from "@/ui-components/Input";
import { Button } from "@/components/ui/button";
import BinarySwitch from "@/ui-components/BinarySwitch";

type State = {
  url: string;
  topic: string;
  isWebsocket: boolean;
  canFetch: boolean | undefined;
  running: boolean;
};
export default function InputUI(props: ServiceUIProps) {
  const [state, setState] = useState<State>({
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
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 300, height: undefined }}
    >
      <div
        style={{
          margin: 10,
        }}
      >
        <Input
          title="URL"
          value={url}
          onChange={(newUrl) => service.configure({ url: newUrl })}
        />

        {isWebsocket && (
          <Input
            title="topic"
            value={topic}
            onChange={(newTopic) => service.configure({ topic: newTopic })}
          />
        )}
        {canFetch === true && (
          <Button
            variant="ghost"
            className="my-2 w-full"
            onClick={() => service.configure({ fetch: url })}
          >
            Fetch
          </Button>
        )}
        {canFetch === false && (
          <BinarySwitch
            label="Input active"
            value={running}
            onChange={(newRunning) =>
              service.configure({ running: newRunning })
            }
          />
        )}
      </div>
    </ServiceUI>
  );
}
