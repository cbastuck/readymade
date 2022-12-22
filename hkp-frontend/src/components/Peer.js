import React, { Component } from "react";

import Peerjs from "peerjs";

import { PeersCtx } from "../PeersContext";

function logError(err) {
  console.error("Error in <Peer />", err);
}

export default class Peer extends Component {
  componentDidMount() {
    const { active } = this.props;
    if (active !== undefined && active) {
      this.initPeer();
    }
  }

  componentWillUnmount() {
    this.closePeer();
  }

  componentDidUpdate(prevProps) {
    const { name, active } = this.props;
    if (name !== prevProps.name) {
      this.closePeer(prevProps.name);
      this.initPeer();
    }
    if (active !== undefined && active !== prevProps.active) {
      this.closePeer();
      if (active) {
        this.initPeer();
      }
    }
  }

  initPeer = () => {
    if (this.peer) {
      console.warn(
        "Peer.initPeer previous peer did not shutdown - closing now"
      );
      this.closePeer();
    }
    const {
      name = "unnamed-peer",
      onData,
      peerHost,
      usePeerPort,
      usePeerRoutePath,
      usePeerOverHTTPS,
    } = this.props;
    const peer = new Peerjs(name, {
      host: peerHost,
      port: usePeerPort ? usePeerPort : usePeerOverHTTPS ? 443 : 80,
      path: usePeerRoutePath ? usePeerRoutePath : "/peers",
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
      const { onClose = () => {} } = this.props;
      onClose(name);
    });

    // called when a remote peer is connecting to this peer
    peer.on("connection", (connection) => {
      const { onConnectionOpened = () => {}, onConnectionClosed = () => {} } =
        this.props;
      connection.on("data", (data) => onData(data, connection.peer));
      connection.on("close", () => {
        onConnectionClosed(name);
      });
      onConnectionOpened(name, connection);
    });

    peer.on("disconnected", () => {
      const { onDisconnect = () => {} } = this.props;
      onDisconnect(name);
    });

    peer.on("error", (err) => {
      const { onError = logError } = this.props;
      onError(err);
    });
  };

  closePeer = (name) => {
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

Peer.contextType = PeersCtx;
