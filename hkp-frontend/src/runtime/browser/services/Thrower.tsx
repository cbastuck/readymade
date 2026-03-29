import { useState } from "react";

import InputField from "../../../components/shared/InputField";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/thrower";
const serviceName = "Thrower";

function ThrowerUI(props: any): JSX.Element {
  const [pushUrl, setPushUrl] = useState<string>("");
  const [id, setId] = useState<string>("");

  const onInit = (initial: { pushUrl?: string }): void => {
    const { pushUrl: url = "" } = initial;
    setPushUrl(url);
  };

  const onNotification = (notification: { pushUrl?: string }): void => {
    const { pushUrl: url } = notification;
    if (url !== undefined) {
      setPushUrl(url);
    }
  };

  const renderMain = (service: any): JSX.Element => {
    return (
      <div style={s(t.fill, { display: "flex", flexDirection: "column" })}>
        <InputField
          label="URL"
          value={pushUrl}
          onChange={async (url: string) => {
            await service.configure({ pushUrl: url });
            setPushUrl(url);
          }}
        />
        <InputField label="Id" value={id} onChange={(i: string) => setId(i)} />
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "main", render: renderMain }]}
    />
  );
}

class Thrower {
  uuid: string;
  board: any;
  app: any;
  pushUrl: string;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.pushUrl = "";
  }

  configure = async (config: { pushUrl?: string }): Promise<void> => {
    const { pushUrl } = config;
    if (pushUrl !== undefined) {
      this.pushUrl = pushUrl;
    }
  };

  destroy = (): void => {};

  async process(params: any): Promise<any> {
    if (this.pushUrl) {
      // TODO: probably this should be runtime functionality
      // because this way, without encoding the params,
      // it only works for text content
      await fetch(this.pushUrl, {
        method: "POST",
        body: JSON.stringify(params),
      });
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Thrower(app, board, _descriptor, id),
  createUI: ThrowerUI,
};

export default descriptor;
