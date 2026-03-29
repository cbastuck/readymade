import { useState } from "react";

import InputField from "../../../components/shared/InputField";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/receiver";
const serviceName = "Receiver";

function ReceiverUI(props: any): JSX.Element {
  const [wall, setWall] = useState<string>("");
  const [id, setId] = useState<string>("");

  const onInit = (_initial: any): void => {};

  const onNotification = (_notification: any): void => {};

  const renderMain = (): JSX.Element => {
    return (
      <div style={s(t.fill, { display: "flex", flexDirection: "column" })}>
        <InputField
          label="Wall"
          value={wall}
          onChange={(w: string) => setWall(w)}
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

class Receiver {
  uuid: string;
  board: any;
  app: any;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure = (_config: any): void => {};

  destroy = (): void => {};

  process(_params: any): void {}
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Receiver(app, board, _descriptor, id),
  createUI: ReceiverUI,
};

export default descriptor;
