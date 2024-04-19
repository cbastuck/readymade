import { Component } from "react";

import ServiceUI from "../../services/ServiceUI";
import { AppImpl, ServiceClass, ServiceUIProps } from "../../../types";

const serviceId = "hookup.to/service/media-player";
const serviceName = "Media Player";

export class MediaPlayerUI extends Component<ServiceUIProps> {
  createdObjectUrl: string | null = null;
  audio: HTMLAudioElement | null = null;

  componentWillUnmount(): void {
    this.resetIfNeeded();
  }

  onInit(initialState: object) {
    this.setState({
      ...initialState,
    });
  }

  onNotification = (params: any) => {
    const { process: data } = params;
    if (this.audio && data) {
      this.resetIfNeeded();
      if (data instanceof Blob) {
        this.playBlob(data);
      } else {
        throw new Error("Unsupported media format");
      }
    }
  };

  playBlob = (blob: Blob) => {
    try {
      if (this.audio) {
        this.createdObjectUrl = URL.createObjectURL(blob);
        this.audio.src = this.createdObjectUrl;
        this.audio.play();
      }
    } catch (err) {
      console.error("MediaPlayer error creating object URL", err);
    }
  };

  resetIfNeeded = () => {
    if (this.createdObjectUrl) {
      URL.revokeObjectURL(this.createdObjectUrl);
      this.createdObjectUrl = null;
    }
  };

  renderMain = () => {
    return (
      <audio
        ref={(audio) => (this.audio = audio)}
        style={{ width: "100%" }}
        controls
        autoPlay
      />
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification}
        segments={[{ name: "Main", render: this.renderMain }]}
      />
    );
  }
}

class MediaPlayer {
  uuid: string;
  board: string;
  app: AppImpl;
  constructor(
    app: AppImpl,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async configure() {}

  async destroy() {}

  async process(params: any) {
    this.app.notify(this, { process: params });
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new MediaPlayer(app, board, descriptor, id) as any,
  createUI: MediaPlayerUI,
};

export default descriptor;
