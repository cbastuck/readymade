import { AppInstance, DataEnvelope, ServiceClass } from "hkp-frontend/src/types";

import PeerSocketUI from "./PeerSocketUI";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import PeerConnection, { resolveActivePeerHost } from "./PeerConnection";

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
  peerMount: string | null;
  /**
   * Whether this socket may ask its signalling server who else is connected.
   * A server can refuse on its own (see PeerJsHostDescriptor.discoverable);
   * this is the same choice made locally, for servers configured by hand where
   * there is no descriptor to carry it. Off means no such request is ever sent.
   */
  peerDiscovery: boolean;
};

/** How long to keep waiting for a referenced Peer Server's runtime to publish
 *  its endpoint before giving up on the connection attempt. */
const MOUNT_RESOLVE_TIMEOUT_MS = 15000;
const MOUNT_RETRY_INTERVAL_MS = 250;

class PeerSocket extends ServiceBase<State> {
  // The live peer connection is owned by the service, not its UI, so it stays
  // alive whether or not the ServiceUI panel is mounted (crucial on mobile,
  // where panels mount lazily). The connection is established lazily on the
  // first configure() — never in the constructor — so instantiating the
  // service (e.g. in tests) never opens a socket.
  private connection: PeerConnection;
  private mountRetryTimer: ReturnType<typeof setTimeout> | null = null;

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
      peerMount: null,
      peerDiscovery: true,
    });

    this.connection = new PeerConnection({
      onData: (envelope) => this.handleIncoming(envelope),
      onError: (err) => this.pushErrorNotification(err.message),
    });

    // Override ServiceBase's arrow-function property so toggling bypass also
    // starts/stops the live connection.
    this.setBypass = (bypass: boolean) => {
      this.bypass = !!bypass;
      this.app.notify(this as any, { bypass: this.bypass });
      this.syncConnection();
    };
  }

  // Forward an inbound envelope to the next service, honouring the mode and the
  // unpack-received-data setting. Send-only sockets ignore inbound data.
  private handleIncoming(envelope: DataEnvelope) {
    if (this.state.mode === "Send only") {
      return;
    }
    const data = this.state.extractIncomingData ? envelope?.data : envelope;
    this.app.next(this, data);
  }

  // Bring the live connection in line with the current state + bypass. Cheap to
  // call repeatedly: PeerConnection.connect() is a no-op when nothing changed.
  private syncConnection() {
    this.cancelMountRetry();

    if (this.bypass) {
      this.connection.close();
      return;
    }

    const host = resolveActivePeerHost(
      this.state,
      this.app.getServiceStateInRuntime,
    );
    if (host) {
      this.connection.connect(this.state.peerName, host);
      return;
    }

    // Only a mount reference can fail to resolve, and only because the runtime
    // that owns the Peer Server has not published its endpoint yet — boards
    // restore their runtimes concurrently, so this service can be configured
    // first. Poll until it appears rather than leaving the socket dead.
    this.retryMountResolve(Date.now() + MOUNT_RESOLVE_TIMEOUT_MS);
  }

  private retryMountResolve(deadline: number) {
    this.mountRetryTimer = setTimeout(() => {
      this.mountRetryTimer = null;
      if (this.bypass) {
        return;
      }
      const host = resolveActivePeerHost(
        this.state,
        this.app.getServiceStateInRuntime,
      );
      if (host) {
        this.connection.connect(this.state.peerName, host);
        return;
      }
      if (Date.now() >= deadline) {
        this.pushErrorNotification(
          `Peer Server "${this.state.peerMount}" did not publish an endpoint`,
        );
        return;
      }
      this.retryMountResolve(deadline);
    }, MOUNT_RETRY_INTERVAL_MS);
  }

  private cancelMountRetry() {
    if (this.mountRetryTimer !== null) {
      clearTimeout(this.mountRetryTimer);
      this.mountRetryTimer = null;
    }
  }

  configure(config: any) {
    // Backwards-compatible manual injection path: a caller (e.g. a facade) can
    // still push inbound data through configure({ incoming }).
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

    if (config.peerMount !== undefined) {
      const mount = config.peerMount === "" ? null : config.peerMount;
      if (needsUpdate(mount, this.state.peerMount)) {
        this.state.peerMount = mount as string | null;
        this.app.notify(this, { peerMount: this.state.peerMount });
      }
    }

    if (config.peerDiscovery !== undefined) {
      const discovery = !!config.peerDiscovery;
      if (needsUpdate(discovery, this.state.peerDiscovery)) {
        this.state.peerDiscovery = discovery;
        this.app.notify(this, { peerDiscovery: this.state.peerDiscovery });
      }
    }

    // Apply any identity/host/bypass change to the live connection.
    this.syncConnection();
  }

  process(params: any) {
    // Receive-only sockets never send upstream data on.
    if (this.state.mode !== "Receive only") {
      void this.connection.sendData(this.state.targetPeer, params);
    }
    this.app.notify(this, { data: params });
  }

  destroy() {
    this.cancelMountRetry();
    this.connection.close();
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
