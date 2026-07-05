import Peerjs, { DataConnection } from "peerjs";

import { DataEnvelope, PeerJsHostDescriptor } from "hkp-frontend/src/types";
import { availableDiscoveryPeerHosts } from "hkp-frontend/src/views/playground/common";
import { resolveTemplateVars } from "hkp-frontend/src/templateVars";

/**
 * The subset of PeerSocket state needed to resolve which PeerJS server to
 * connect to. Kept structural so both the service and its UI can pass their
 * own state shape.
 */
export type PeerHostState = {
  peerHost: string | null;
  peerPort: number | null;
  peerPath: string | null;
  peerSecure: boolean | null;
};

export type PeerHostParams = {
  host: string | undefined;
  port: number | undefined;
  path: string;
  secure: boolean;
};

/**
 * Resolves the active PeerJS host from configured overrides, falling back to
 * the first discovery host when neither host nor port is set. Shared by the
 * service (which owns the live connection) and the UI (which displays the
 * server and fetches the peer list) so both always agree on the target server.
 */
export function resolveActivePeerHost(state: PeerHostState): PeerHostParams {
  const hostDescriptor: PeerJsHostDescriptor | undefined =
    availableDiscoveryPeerHosts[0];
  const resolvedPeerHost = state.peerHost
    ? resolveTemplateVars(state.peerHost)
    : null;
  const isCustomServer = state.peerHost !== null || state.peerPort !== null;
  return {
    host: isCustomServer
      ? (resolvedPeerHost ?? hostDescriptor?.host)
      : hostDescriptor?.host,
    port: isCustomServer
      ? (state.peerPort ?? undefined)
      : hostDescriptor?.port,
    path: isCustomServer ? (state.peerPath ?? "/") : (hostDescriptor?.path ?? "/"),
    secure: isCustomServer
      ? (state.peerSecure ?? false)
      : (hostDescriptor?.secure ?? false),
  };
}

function sameHost(a: PeerHostParams, b: PeerHostParams): boolean {
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.path === b.path &&
    a.secure === b.secure
  );
}

type PeerConnectionHandlers = {
  onData: (envelope: DataEnvelope, fromPeer: string) => void;
  onError?: (err: Error) => void;
};

/**
 * Owns a live PeerJS connection for a PeerSocket service, independent of any
 * React tree. Previously this behaviour lived in the <Peer> component and the
 * PeersContext provider, which meant the connection only existed while the
 * service's UI panel was mounted — so it silently died on mobile, where panels
 * are mounted lazily. Keeping it here makes the service work headless, matching
 * the HKP contract that a service is the unit of behaviour, not its UI.
 */
export default class PeerConnection {
  private handlers: PeerConnectionHandlers;
  private peer: Peerjs | null = null;
  private ready = false;
  private name: string | undefined;
  private host: PeerHostParams | null = null;

  // Cached outbound connections keyed by destination peer, plus in-flight
  // connection attempts so concurrent sends don't open duplicate connections.
  private outbound: { [dst: string]: DataConnection } = {};
  private pending: { [dst: string]: boolean } = {};

  constructor(handlers: PeerConnectionHandlers) {
    this.handlers = handlers;
  }

  /**
   * (Re)establishes the peer with the given identity and host. A no-op when the
   * identity and host are unchanged, so it is safe to call on every configure.
   */
  connect(name: string, host: PeerHostParams) {
    if (
      this.peer &&
      this.name === name &&
      this.host &&
      sameHost(this.host, host)
    ) {
      return;
    }

    this.close();

    if (!name || !host.host) {
      return;
    }

    this.name = name;
    this.host = host;

    const peer = new Peerjs(name, {
      host: host.host,
      port: host.port ? host.port : host.secure ? 443 : 80,
      path: host.path,
      secure: host.secure,
    });
    this.peer = peer;

    peer.on("open", () => {
      this.ready = true;
    });

    peer.on("disconnected", () => {
      this.ready = false;
    });

    peer.on("close", () => {
      this.ready = false;
    });

    // A remote peer is connecting to us: forward its inbound data.
    peer.on("connection", (connection: DataConnection) => {
      connection.on("data", (data: unknown) =>
        this.handlers.onData(data as DataEnvelope, connection.peer),
      );
    });

    peer.on("error", (err) => {
      if (this.handlers.onError) {
        this.handlers.onError(err);
      } else {
        console.error("PeerConnection error", err);
      }
    });
  }

  /**
   * Sends data to a target peer, opening (and caching) an outbound connection
   * on demand. Drops the send if the peer is not open yet or no target is set,
   * matching the previous provider behaviour of refusing to send from an
   * unregistered peer.
   */
  async sendData(targetPeer: string, data: unknown) {
    if (!this.peer || !this.ready || !this.name || !targetPeer) {
      return;
    }

    const envelope: DataEnvelope = { sender: this.name, data };

    const existing = this.outbound[targetPeer];
    if (existing) {
      existing.send(envelope);
      return;
    }

    if (this.pending[targetPeer]) {
      return;
    }
    this.pending[targetPeer] = true;

    try {
      const connection = await this.openConnection(targetPeer);
      connection.on("close", () => {
        delete this.outbound[targetPeer];
      });
      connection.send(envelope);
      this.outbound[targetPeer] = connection;
    } catch (err) {
      console.log("PeerConnection: could not connect to", targetPeer, err);
    } finally {
      delete this.pending[targetPeer];
    }
  }

  private openConnection(dst: string): Promise<DataConnection> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error("peer not initialised"));
        return;
      }
      const connection = this.peer.connect(dst);
      if (!connection) {
        reject(new Error(`could not open connection to ${dst}`));
        return;
      }
      connection.on("open", () => resolve(connection));
      connection.on("error", (err) => reject(err));
    });
  }

  /** Tears down the peer and all cached connections. */
  close() {
    for (const dst of Object.keys(this.outbound)) {
      try {
        this.outbound[dst].close();
      } catch {
        // best-effort — the connection may already be gone
      }
    }
    this.outbound = {};
    this.pending = {};

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.ready = false;
    this.name = undefined;
    this.host = null;
  }
}
