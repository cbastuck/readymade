import { useEffect, useRef, useContext } from "react";

import Peerjs, { DataConnection } from "peerjs";

import { DataEnvelope, Peer } from "../types";
import { PeersCtx } from "../PeersContext";

type Props = {
  active: boolean;
  name: string | undefined;
  peerHost?: string;
  usePeerPort?: number;
  usePeerRoutePath?: string;
  isSecure?: boolean;

  children?: JSX.Element | JSX.Element[];

  onData: (envelope: DataEnvelope, peer: string) => void;

  onConnectionOpened?: (syncedPeer: string, connection: DataConnection) => void;
  onConnectionClosed?: (dst: string) => void;

  onOpen?: () => void;
  onClose?: (name: string) => void;
  onDisconnect?: (name: string) => void;
  onError?: (err: Error) => void;
};

export default function PeerComponent(props: Props) {
  const context = useContext(PeersCtx);
  const peerRef = useRef<Peer | null>(null);

  // Keep a ref to props so event handlers always have fresh values
  const propsRef = useRef(props);
  propsRef.current = props;

  const contextRef = useRef(context);
  contextRef.current = context;

  const closePeerRef = useRef((name?: string) => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      const n = name || propsRef.current.name;
      if (n) {
        contextRef.current?.onPeerClosed(n);
      }
    }
  });

  const initPeerRef = useRef((peerHost: string) => {
    if (peerRef.current) {
      console.warn(
        "Peer.initPeer previous peer did not shutdown - closing now"
      );
      closePeerRef.current();
    }
    const {
      name,
      onData,
      usePeerPort,
      usePeerRoutePath,
      isSecure,
    } = propsRef.current;
    if (!name) {
      return;
    }
    const peer: Peer = new Peerjs(name, {
      host: peerHost,
      port: usePeerPort ? usePeerPort : isSecure ? 443 : 80,
      path: usePeerRoutePath ? usePeerRoutePath : "/peers",
      secure: !!isSecure,
    });

    peer.on("open", () => {
      // Allow PeerContext signaling connections to this instance
      peer.onConnectionOpened = propsRef.current.onConnectionOpened;
      peer.onConnectionClosed = propsRef.current.onConnectionClosed;
      peerRef.current = peer;
      contextRef.current?.onPeer(name, peer);
      if (propsRef.current.onOpen) {
        propsRef.current.onOpen();
      }
    });

    peer.on("close", () => {
      const { onClose } = propsRef.current;
      onClose?.(name);
    });

    // called when a remote peer is connecting to this peer
    peer.on("connection", (connection: DataConnection) => {
      const { onConnectionOpened, onConnectionClosed } = propsRef.current;
      connection.on("data", (data: unknown) =>
        onData(data as DataEnvelope, connection.peer)
      );
      connection.on("close", () => {
        onConnectionClosed?.(name);
      });
      onConnectionOpened?.(name, connection);
    });

    peer.on("disconnected", () => {
      const { onDisconnect } = propsRef.current;
      onDisconnect?.(name);
    });

    peer.on("error", (err) => {
      const { onError = logError } = propsRef.current;
      onError(err);

      /*
      if (peerRef.current) {
        peerRef.current.reconnect();
      }*/
    });
  });

  // componentDidMount + componentWillUnmount
  useEffect(() => {
    const { active, peerHost } = propsRef.current;
    if (active && !!peerHost) {
      initPeerRef.current(peerHost);
    }
    return () => {
      closePeerRef.current();
    };
  }, []);

  // componentDidUpdate: react to changes in name and active
  const prevNameRef = useRef(props.name);
  const prevActiveRef = useRef(props.active);

  useEffect(() => {
    const prevName = prevNameRef.current;
    const prevActive = prevActiveRef.current;
    const { name, active, peerHost } = props;

    if (name !== prevName && !!peerHost) {
      closePeerRef.current(prevName);
      initPeerRef.current(peerHost);
    }
    if (active !== prevActive) {
      closePeerRef.current();
      if (active && !!peerHost) {
        initPeerRef.current(peerHost);
      }
    }

    prevNameRef.current = name;
    prevActiveRef.current = active;
  });

  return <div>{props.children || null}</div>;
}

function logError(err: Error) {
  console.error("Error in <Peer />", err);
}
