import { Component } from "react";

import InputField from "../../../components/shared/InputField";
import ServiceUI from "../../services/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/thrower";
const serviceName = "Thrower";

type ThrowerUIState = {
  pushUrl: string;
  id: string;
};

class ThrowerUI extends Component<any, ThrowerUIState> {
  state: ThrowerUIState = {
    pushUrl: "",
    id: "",
  };

  onInit = (initial: { pushUrl?: string }): void => {
    const { pushUrl = "" } = initial;
    this.setState({
      pushUrl,
    });
  };

  onNotification = (notification: { pushUrl?: string }): void => {
    const { pushUrl } = notification;
    if (pushUrl !== undefined) {
      this.setState({ pushUrl });
    }
  };

  renderMain = (service: any): JSX.Element => {
    const { pushUrl, id } = this.state;
    return (
      <div style={s(t.fill, { display: "flex", flexDirection: "column" })}>
        <InputField
          label="URL"
          value={pushUrl}
          onChange={async (pushUrl: string) => {
            await service.configure({ pushUrl });
            this.setState({ pushUrl });
          }}
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
