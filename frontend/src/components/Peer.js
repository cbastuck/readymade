import React, { Component } from "react";

import Peerjs from "peerjs";

import { PeersCtx } from "../PeersContext";

const peerHost = `${window.location.host}`;
const isHTTPS = window.location.protocol === "https:";

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
    const { name = "unnamed-peer", onData } = this.props;
    const { onPeer } = this.context;
    const peer = new Peerjs(name, {
      host: peerHost,
      port: isHTTPS ? 443 : 80,
      path: "/peers",
    });

    peer.on("open", () => {
      if (this.peer) {
        console.warn("Peer peer opened but the previous peer did not shutdown");
        this.closePeer();
      }
      this.peer = peer;
      onPeer(name, peer);

      if (this.props.onOpen) {
        this.props.onOpen();
      }
    });

    peer.on("connection", (connection) =>
      connection.on("data", (data) => onData(data, connection.peer))
    );
  };

  closePeer = (name) => {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;

      const { onPeerClosed } = this.context;
      onPeerClosed(name || this.props.name);
    }
  };

  render() {
    return <div>{this.props.children}</div>;
  }
}

Peer.contextType = PeersCtx;
