import { Component, createContext } from "react";
import { DataConnection } from "peerjs";

import { removeKeyFromObject } from "./runtime/browser/services/helpers";
import { ConnectionAndPeer, Peer, PeerConnections } from "./types";

export type PeersContextState = {
  peers: { [peerName: string]: Peer };
  connections: PeerConnections;
  peerNames: Array<string>;
  onPeer: (peerName: string, peer: Peer) => void;
  onPeerClosed: (peerName: string) => void;
  updatePeers: (peer?: Peer) => void;
  closeConnection: (srcPeerName: string, dstPeerName: string) => void;
  sendData: (srcPeer: string, dstPeer: string, result: any) => Promise<void>;
};

type Props = {
  children: JSX.Element | JSX.Element[];
};

const PeersCtx = createContext<PeersContextState | null>(null);

class PeersProvider extends Component<Props, PeersContextState> {
  pendingConnections: { [connectionId: string]: boolean } = {};

  constructor(props: Props) {
    super(props);
    this.state = {
      peers: {},
      connections: {},
      peerNames: [],
      onPeer: this.onPeer,
      onPeerClosed: this.onPeerClosed,
      updatePeers: this.updatePeers,
      closeConnection: this.closeConnection,
      sendData: this.sendData,
    };
  }

  closeConnection = (srcPeerName: string, dstPeerName: string) => {
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
    this.setState({
      connections: {
        ...connections,
        [srcPeerName]: removeKeyFromObject(srcConnections, dstPeerName),
      },
    });
  };

  onPeer = (peerName: string, peer: Peer) => {
    peer.on("error", (err: any) => {
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

  onPeerClosed = (peerName: string) => {
    const { peers, peerNames, connections } = this.state;
    this.setState({
      peers: removeKeyFromObject(peers, peerName),
      peerNames: peerNames.filter((x) => x !== peerName),
      connections: Object.keys(connections).reduce((acc, cur) => {
        if (cur === peerName) {
          return acc;
        }
        return {
          ...acc,
          [cur]: removeKeyFromObject(connections[cur], peerName),
        };
      }, {}),
    });
  };

  updatePeers = (peer?: Peer) => {
    if (!peer) {
      const firstPeer = Object.keys(this.state.peers)[0];
      peer = firstPeer ? this.state.peers[firstPeer] : undefined;
    }

    if (peer) {
      peer.listAllPeers((peerNames) => this.setState({ peerNames }));
    } else {
      console.warn("PeerContext.updatePeers no peers available");
    }
  };

  connectToPeer = (src: string, dst: string): Promise<ConnectionAndPeer> => {
    return new Promise((resolve, reject) => {
      const srcPeer: Peer = this.state.peers[src];
      if (!srcPeer) {
        console.warn(
          `Trying to send data from an unregistered peer from: ${src} to: ${dst} know peers: ${this.state.peers}`
        );
        return reject();
      }

      const connection: DataConnection = srcPeer.connect(dst);
      if (connection) {
        connection.on("open", () => resolve({ connection, srcPeer }));
      } else {
        return reject(); // TODO: connection.on("error", reject);
      }
    });
  };

  sendData = async (src: string, dst: string, data: any) => {
    const connectionId = `${src}.${dst}`;
    const { connections } = this.state;
    const envelope = {
      sender: src,
      data,
    };
    const srcConnections = connections[src] || {};
    const connection = srcConnections[dst]; // use connectionId
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
      if (srcPeer.onConnectionOpened) {
        srcPeer.onConnectionOpened(dst, connection);
      }

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
      console.log("Connection is not available anymore", src, dst, err);
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
