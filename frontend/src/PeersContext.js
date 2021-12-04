import React, { Component, createContext } from "react";

import { removeKeyFromObject } from "./runtime/services/helpers";

const PeersCtx = createContext();

class PeersProvider extends Component {
  constructor(props) {
    super(props);
    this.state = {
      peers: {},
      connections: {},
      peerNames: [],
      onPeer: this.onPeer,
      onPeerClosed: this.onPeerClosed,
      updatePeers: this.updatePeers,
    };
  }

  onPeer = (peerName, peer) => {
    peer.on("error", (err) => {
      console.error("PeersProvider peer.onError", err);
    });

    peer.on("close", () => this.onPeerClosed(peerName));

    this.setState({
      peers: {
        ...this.state.peers,
        [peerName]: peer,
      },
    });

    this.updatePeers(peer);
  };

  onPeerClosed = (peerName) => {
    const { peers, peerNames } = this.state;
    this.setState({
      peers: removeKeyFromObject(peers, peerName),
      peerNames: peerNames.filter((x) => x !== peerName),
    });
  };

  updatePeers = (peer) => {
    if (!peer) {
      const firstPeer = Object.keys(this.state.peers)[0];
      peer = firstPeer && this.state.peers[firstPeer];
    }

    if (peer) {
      peer.listAllPeers((peerNames) => this.setState({ peerNames }));
    } else {
      console.warn("PeerContext.updatePeers no peers available");
    }
  };

  sendData = (src, dst, data) => {
    const { connections, peers } = this.state;
    const srcConnections = connections[src] || {};
    const envelope = {
      sender: src,
      data,
    };
    let connection = srcConnections[dst];
    if (connection) {
      connection.send(envelope);
      return;
    }
    const srcPeer = peers[src];
    if (!srcPeer) {
      console.warn(
        `Trying to send data from an unregistered peer from: ${src} to: ${dst} know peers: ${this.state.peers}`
      );
      return;
    }
    connection = srcPeer.connect(dst);
    if (connection) {
      connection.on("open", () => {
        connection.send(envelope);
        this.setState({
          connections: {
            ...connections,
            [src]: {
              ...srcConnections,
              [dst]: connection,
            },
          },
        });
      });
      connection.on("close", () => {
        console.log("Connection closed from", src, "to", dst);
        this.setState({
          connections: {
            ...srcConnections,
            [src]: removeKeyFromObject(srcConnections, dst),
          },
        });
      });
    } else {
      console.log("Connection is not available anymore", src, dst);
      this.updatePeers();
    }
  };

  render() {
    const { children } = this.props;
    return (
      <PeersCtx.Provider
        value={{
          ...this.state,
        }}
      >
        {children}
      </PeersCtx.Provider>
    );
  }
}

const PeersConsumer = PeersCtx.Consumer;
export { PeersConsumer, PeersCtx };
export default PeersProvider;
