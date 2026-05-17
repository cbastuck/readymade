import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

import PeerSocketUI from "./PeerSocketUI";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceName = "Peer Socket";
const serviceId = "hookup.to/service/peer-socket";

type State = {
  mode: "Receive only" | "Send only" | "Receive and Send";
  peerName: string;
  targetPeer: string;
  extractIncomingData: boolean;
  peerPort: number | null;
  peerPath: string | null;
  peerHost: string | null;
  peerSecure: boolean | null;
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
      targetPeer: `NoName${Math.floor(Math.random() * 100)}`,
      extractIncomingData: false,
      peerPort: null,
      peerPath: null,
      peerHost: null,
      peerSecure: null,
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

    if (config.peerPort !== undefined) {
      // coerce string → number (board JSON substitution produces strings)
      const rawPort = config.peerPort;
      const port =
        typeof rawPort === "string"
          ? rawPort === "" ? null : parseInt(rawPort, 10)
          : typeof rawPort === "number"
          ? rawPort
          : null;
      if (needsUpdate(port, this.state.peerPort)) {
        this.state.peerPort = port;
        this.app.notify(this, { peerPort: this.state.peerPort });
      }
    }

    if (config.peerPath !== undefined) {
      const path = config.peerPath === "" ? null : config.peerPath;
      if (needsUpdate(path, this.state.peerPath)) {
        this.state.peerPath = path as string | null;
        this.app.notify(this, { peerPath: this.state.peerPath });
      }
    }

    if (config.peerHost !== undefined) {
      const host = config.peerHost === "" ? null : config.peerHost;
      if (needsUpdate(host, this.state.peerHost)) {
        this.state.peerHost = host as string | null;
        this.app.notify(this, { peerHost: this.state.peerHost });
      }
    }

    if (config.peerSecure !== undefined) {
      const secure = config.peerSecure === "" ? null : config.peerSecure;
      if (needsUpdate(secure, this.state.peerSecure)) {
        this.state.peerSecure = secure as boolean | null;
        this.app.notify(this, { peerSecure: this.state.peerSecure });
      }
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
