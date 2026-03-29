import { Component } from "react";

import InputField from "../../../components/shared/InputField";
import ServiceUI from "../../services/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/receiver";
const serviceName = "Receiver";

type ReceiverUIState = {
  wall: string;
  id: string;
};

class ReceiverUI extends Component<any, ReceiverUIState> {
  state: ReceiverUIState = {
    wall: "",
    id: "",
  };

  onInit = (_initial: any): void => {};

  onNotification = (_notification: any): void => {};

  renderMain = (): JSX.Element => {
    const { wall, id } = this.state;
    return (
      <div style={s(t.fill, { display: "flex", flexDirection: "column" })}>
        <InputField
          label="Wall"
          value={wall}
          onChange={(wall: string) => this.setState({ wall })}
        />
        <InputField
          label="Id"
          value={id}
          onChange={(id: string) => this.setState({ id })}
        />
      </div>
    );
  };

  render(): JSX.Element {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
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
