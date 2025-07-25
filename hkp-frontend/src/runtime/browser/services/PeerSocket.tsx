import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

import PeerSocketUI from "./PeerSocketUI";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceName = "Peer Socket";
const serviceId = "hookup.to/service/peer-socket";

type State = {
  mode: "Receive only" | "Send only" | "Receive and Send";
  peerName: string;
  targetPeer: string | undefined;
  extractIncomingData: boolean;
};

class PeerSocket extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      mode: "Receive only",
      peerName: `NoName${Math.floor(Math.random() * 100)}`,
      targetPeer: undefined,
      extractIncomingData: false,
    });
  }

  configure(config: any) {
    if (config.incoming !== undefined) {
      const data = this.state.extractIncomingData
        ? config.incoming.data
        : config.incoming;
      this.app.next(this, data);
    }

    if (needsUpdate(config.peerName, this.state.peerName)) {
      this.state.peerName = config.peerName;
      this.app.notify(this, { peerName: this.state.peerName });
    }

    if (needsUpdate(config.targetPeer, this.state.targetPeer)) {
      this.state.targetPeer = config.targetPeer;
      this.app.notify(this, { targetPeer: this.state.targetPeer });
    }

    if (needsUpdate(config.mode, this.state.mode)) {
      this.state.mode = config.mode;
      this.app.notify(this, { mode: this.state.mode });
    }
    if (
      needsUpdate(config.extractIncomingData, this.state.extractIncomingData)
    ) {
      this.state.extractIncomingData = config.extractIncomingData;
      this.app.notify(this, {
        extractIncomingData: this.state.extractIncomingData,
      });
    }
  }

  process(params: any) {
    this.app.notify(this, { data: params });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new PeerSocket(app, board, descriptor, id),
  createUI: PeerSocketUI,
};

export default descriptor;
