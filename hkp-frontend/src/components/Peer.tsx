import { Component } from "react";

import Peerjs, { DataConnection } from "peerjs";

import { DataEnvelope, Peer } from "../types";
import { PeersContextState, PeersCtx } from "../PeersContext";

type Props = {
  active: boolean;
  name: string;
  peerHost?: string;
  usePeerPort?: number;
  usePeerRoutePath?: string;
  isSecure?: boolean;

  children: JSX.Element | JSX.Element[];

  onData: (envelope: DataEnvelope, peer: string) => void;

  onConnectionOpened?: (syncedPeer: string, connection: DataConnection) => void;
  onConnectionClosed?: (dst: string) => void;

  onOpen?: () => void;
  onClose?: (name: string) => void;
  onDisconnect?: (name: string) => void;
  onError?: (err: Error) => void;
};

export default class PeerComponent extends Component<Props> {
  static contextType = PeersCtx;
  context!: PeersContextState;

  peer: Peer | null = null;

  componentDidMount() {
    const { active, peerHost } = this.props;
    if (active && !!peerHost) {
      this.initPeer(peerHost);
    }
  }

  componentWillUnmount() {
    this.closePeer();
  }

  componentDidUpdate(prevProps: Props) {
    const { name, active, peerHost } = this.props;
    if (name !== prevProps.name && !!peerHost) {
      this.closePeer(prevProps.name);
      this.initPeer(peerHost);
    }
    if (active !== prevProps.active) {
      this.closePeer();
      if (active && !!peerHost) {
        this.initPeer(peerHost);
      }
    }
  }

  initPeer = (peerHost: string) => {
    if (this.peer) {
      console.warn(
        "Peer.initPeer previous peer did not shutdown - closing now"
      );
      this.closePeer();
    }
    const {
      name = "unnamed-peer",
      onData,

      usePeerPort,
      usePeerRoutePath,
      isSecure,
    } = this.props;
    const peer: Peer = new Peerjs(name, {
      host: peerHost,
      port: usePeerPort ? usePeerPort : isSecure ? 443 : 80,
      path: usePeerRoutePath ? usePeerRoutePath : "/peers",
      secure: !!isSecure,
    });

    peer.on("open", () => {
      // Allow PeerContext signaling connections to this instance
      peer.onConnectionOpened = this.props.onConnectionOpened;
      peer.onConnectionClosed = this.props.onConnectionClosed;
      this.peer = peer;
      this.context.onPeer(name, peer);
      if (this.props.onOpen) {
        this.props.onOpen();
      }
    });

    peer.on("close", () => {
      const { onClose } = this.props;
      onClose && onClose(name);
    });

    // called when a remote peer is connecting to this peer
    peer.on("connection", (connection: DataConnection) => {
      const { onConnectionOpened, onConnectionClosed } = this.props;
      connection.on("data", (data: unknown) =>
        onData(data as DataEnvelope, connection.peer)
      );
      connection.on("close", () => {
        onConnectionClosed && onConnectionClosed(name);
      });
      onConnectionOpened && onConnectionOpened(name, connection);
    });

    peer.on("disconnected", () => {
      const { onDisconnect } = this.props;
      onDisconnect && onDisconnect(name);
    });

    peer.on("error", (err) => {
      const { onError = logError } = this.props;
      onError(err);

      /*
      if (this.peer) {
        this.peer.reconnect();
      }*/
    });
  };

  closePeer = (name?: string) => {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
      this.context.onPeerClosed(name || this.props.name);
    }
  };

  render() {
    return <div>{this.props.children}</div>;
  }
}

function logError(err: Error) {
  console.error("Error in <Peer />", err);
}
