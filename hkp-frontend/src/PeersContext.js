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
      closeConnection: this.closeConnection,
    };
  }

  closeConnection = (srcPeerName, dstPeerName) => {
    const { peers, connections } = this.state;
    const srcPeer = peers[srcPeerName];
    if (srcPeer && srcPeer.onConnectionClosed) {
      srcPeer.onConnectionClosed(dstPeerName);
    }

    const srcConnections = connections[srcPeerName] || {};
    const closedConnection = srcConnections[dstPeerName];
    if (closedConnection) {
      closedConnection.close();
    }
    this.setState(
      {
        connections: {
          ...connections,
          [srcPeerName]: removeKeyFromObject(srcConnections, dstPeerName),
        },
      },
      () => console.log("PeersContext: Updated connections", this.state)
    );
  };

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

  connectToPeer = (src, dst) => {
    return new Promise((resolve, reject) => {
      const srcPeer = this.state.peers[src];
      if (!srcPeer) {
        console.warn(
          `Trying to send data from an unregistered peer from: ${src} to: ${dst} know peers: ${this.state.peers}`
        );
        return reject();
      }

      const connection = srcPeer.connect(dst);
      if (connection) {
        connection.on("open", () => resolve({ connection, srcPeer }));
      } else {
        return reject(); // TODO: connection.on("error", reject);
      }
    });
  };

  sendData = async (src, dst, data) => {
    const connectionId = `${src}.${dst}`;
    const { connections } = this.state;
    const envelope = {
      sender: src,
      data,
    };
    const srcConnections = connections[src] || {};
    let connection = srcConnections[dst]; // use connectionId
    if (connection) {
      connection.send(envelope);
      return;
    }

    try {
      if (this.pendingConnections && this.pendingConnections[connectionId]) {
        return; // only try to establish a connection if none is pending
      }
      this.pendingConnections = {
        ...(this.pendingConnections || {}),
        [connectionId]: true,
      };
      const { connection, srcPeer } = await this.connectToPeer(src, dst);

      console.log("PeersContext: Opened connection from", src, "to", dst);
      srcPeer.onConnectionOpened && srcPeer.onConnectionOpened(dst);

      connection.on("close", () => this.closeConnection(src, dst));

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
    } catch (err) {
      console.log("Connection is not available anymore", src, dst);
      this.updatePeers();
    }
    delete this.pendingConnections[connectionId];
  };

  render() {
    return (
      <PeersCtx.Provider value={this.state}>
        {this.props.children}
      </PeersCtx.Provider>
    );
  }
}

const PeersConsumer = PeersCtx.Consumer;
export { PeersConsumer, PeersCtx };
export default PeersProvider;
