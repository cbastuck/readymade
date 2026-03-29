import {
  createContext,
  forwardRef,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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

export type PeersProviderHandle = PeersContextState;

const PeersProvider = forwardRef<PeersProviderHandle, Props>(function PeersProvider({ children }, ref) {
  const [peers, setPeers] = useState<{ [peerName: string]: Peer }>({});
  const [connections, setConnections] = useState<PeerConnections>({});
  const [peerNames, setPeerNames] = useState<Array<string>>([]);

  // Instance variable equivalent — not state, just a mutable ref
  const pendingConnections = useRef<{ [connectionId: string]: boolean }>({});

  // Keep refs to latest state for use inside async closures
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const peerNamesRef = useRef(peerNames);
  peerNamesRef.current = peerNames;

  const closeConnection = (srcPeerName: string, dstPeerName: string) => {
    const currentPeers = peersRef.current;
    const currentConnections = connectionsRef.current;

    const srcPeer = currentPeers[srcPeerName];
    if (srcPeer && srcPeer.onConnectionClosed) {
      srcPeer.onConnectionClosed(dstPeerName);
    }

    const srcConnections = currentConnections[srcPeerName] || {};
    const closedConnection = srcConnections[dstPeerName];
    if (closedConnection) {
      closedConnection.close();
    }
    setConnections({
      ...currentConnections,
      [srcPeerName]: removeKeyFromObject(srcConnections, dstPeerName),
    });
  };

  const updatePeers = (peer?: Peer) => {
    const currentPeers = peersRef.current;
    if (!peer) {
      const firstPeer = Object.keys(currentPeers)[0];
      peer = firstPeer ? currentPeers[firstPeer] : undefined;
    }

    if (peer) {
      peer.listAllPeers((names) => setPeerNames(names));
    } else {
      console.warn("PeerContext.updatePeers no peers available");
    }
  };

  const onPeerClosed = (peerName: string) => {
    const currentPeers = peersRef.current;
    const currentPeerNames = peerNamesRef.current;
    const currentConnections = connectionsRef.current;

    setPeers(removeKeyFromObject(currentPeers, peerName));
    setPeerNames(currentPeerNames.filter((x) => x !== peerName));
    setConnections(
      Object.keys(currentConnections).reduce((acc, cur) => {
        if (cur === peerName) {
          return acc;
        }
        return {
          ...acc,
          [cur]: removeKeyFromObject(currentConnections[cur], peerName),
        };
      }, {}),
    );
  };

  const onPeer = (peerName: string, peer: Peer) => {
    peer.on("error", (err: any) => {
      console.error("PeersProvider peer.onError", err);
    });

    peer.on("close", () => onPeerClosed(peerName));

    setPeers((prev) => ({
      ...prev,
      [peerName]: peer,
    }));

    updatePeers(peer);
  };

  const connectToPeer = (src: string, dst: string): Promise<ConnectionAndPeer> => {
    return new Promise((resolve, reject) => {
      const srcPeer: Peer = peersRef.current[src];
      if (!srcPeer) {
        console.warn(
          `Trying to send data from an unregistered peer from: ${src} to: ${dst} know peers: ${peersRef.current}`,
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

  const sendData = async (src: string, dst: string, data: any) => {
    const connectionId = `${src}.${dst}`;
    const currentConnections = connectionsRef.current;
    const envelope = {
      sender: src,
      data,
    };
    const srcConnections = currentConnections[src] || {};
    const connection = srcConnections[dst]; // use connectionId
    if (connection) {
      connection.send(envelope);
      return;
    }

    try {
      if (pendingConnections.current && pendingConnections.current[connectionId]) {
        return; // only try to establish a connection if none is pending
      }
      pendingConnections.current = {
        ...(pendingConnections.current || {}),
        [connectionId]: true,
      };
      const { connection: newConnection, srcPeer } = await connectToPeer(src, dst);

      console.log("PeersContext: Opened connection from", src, "to", dst);
      if (srcPeer.onConnectionOpened) {
        srcPeer.onConnectionOpened(dst, newConnection);
      }

      newConnection.on("close", () => closeConnection(src, dst));

      newConnection.send(envelope);
      setConnections((prev) => ({
        ...prev,
        [src]: {
          ...(prev[src] || {}),
          [dst]: newConnection,
        },
      }));
    } catch (err) {
      console.log("Connection is not available anymore", src, dst, err);
      updatePeers();
    }
    delete pendingConnections.current[connectionId];
  };

  const value: PeersContextState = {
    peers,
    connections,
    peerNames,
    onPeer,
    onPeerClosed,
    updatePeers,
    closeConnection,
    sendData,
  };

  // Expose imperative handle for legacy ref usage on this component
  useImperativeHandle(ref, () => value, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PeersCtx.Provider value={value}>
      {children}
    </PeersCtx.Provider>
  );
});

export function usePeersContext() {
  return useContext(PeersCtx);
}

export { PeersCtx };
export default PeersProvider;
