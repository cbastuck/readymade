import { ServiceUIProps } from "@/types";

import ServiceUI from "@/ui-components/service/ServiceUI";
import OllamaPromptUI from "./OllamaPromptUI";
import HackerUI from "./HackerUI";

export default function OllamaCodeCompsiteUI(props: ServiceUIProps) {
  const onInit = (state: any) => {
    console.log("OllamaCodeCompsiteUI.onInit", state);
  };
  const onNotification = (notification: any) => {
    console.log("OllamaCodeCompsiteUI.onNotification", notification);
  };

  const { service } = props;

  const hackerUI = service.app.createSubServiceUI(service.hacker);

  return (
    <ServiceUI
      className="pb-4 overlflow-hidden"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 440, height: 600 }}
    >
      <div className="flex flex-col">
        <OllamaPromptUI
          service={props.service.ollama}
          onServiceAction={props.onServiceAction}
        />

        <HackerUI
          service={props.service.hacker}
          onServiceAction={props.onServiceAction}
        />
      </div>
    </ServiceUI>
  );
}
