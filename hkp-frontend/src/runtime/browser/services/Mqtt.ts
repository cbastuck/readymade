/**
 * Service Documentation
 * Service ID: mqtt
 * Service Name: MQTT
 * Runtime: browser
 * Modes: subscribe (source — every message under `topics` is pushed
 *        downstream), publish (the input is published, then passed on)
 * Key Config: url, __hkpMount (a broker named by reference, resolved), mode,
 *     topics, topic, qos, retain, format, username, password, clientId
 * IO: subscribe: in=anything -> out=the same, unchanged; each received message
 *     is also pushed on as a pass of its own, shaped
 *     { topic, payload, qos, retain }
 *     publish: in=the payload, or { topic, payload, qos?, retain? } -> out=the
 *     input, once the broker has taken the message
 *
 * The browser implementation of the `mqtt` concept hkp-node also provides,
 * sharing its state contract and its message shape, so a board can move a
 * connection between runtimes by moving the service.
 *
 * What differs is what the runtime around it can do. A page opens WebSockets
 * and nothing else, so the broker has to offer MQTT over WebSockets: `ws://`,
 * `wss://`, or an `mqtt-broker` on the board named as
 * `hkp-mount://<runtime>/<service>`. `mqtt://` and `mqtts://` are a Node
 * runtime's to reach, and the service says so rather than failing to connect.
 *
 * Two more consequences of running in the page: the connection lives only
 * while the board is open, and a page served over https may not open `ws://`
 * to anything but this device.
 */
import type { MqttClient } from "mqtt";

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import {
  MOUNT_FIELD,
  parseMountRef,
} from "hkp-frontend/src/runtime/board/mount";
import { resolveCredential } from "hkp-frontend/src/core/secrets";
import ServiceBase from "./ServiceBase";
import MqttUI from "./MqttUI";
import {
  FORMATS,
  MODES,
  Mode,
  MqttQos,
  PayloadFormat,
  decodePayload,
  outgoing,
  readQos,
  readTopics,
  topicProblem,
  webSocketAddress,
} from "./mqtt-message";

const serviceId = "mqtt";
const serviceName = "MQTT";

/** Backoff bounds for re-establishing a connection that went away. */
const RECONNECT_MIN_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;
const CONNECT_TIMEOUT_MS = 15_000;
/** How often a broker named by reference is looked up while it has no
 *  address: briskly while the board is loading, then slowly. */
const MOUNT_LOOKUP_MS = 250;
const MOUNT_LOOKUP_IDLE_MS = 2_000;
const MOUNT_LOOKUPS_BEFORE_SAYING = 20;
/** Message counts are reported at most this often, however fast they move. */
const COUNT_REPORT_MS = 500;

type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type State = {
  url: string;
  // Reserved name: the board's coordinator reads and rewrites it.
  __hkpMount: string;
  mode: Mode;
  topics: string[];
  topic: string;
  qos: MqttQos;
  retain: boolean;
  format: PayloadFormat;
  username: string;
  password: string;
  clientId: string;
  /** What was asked for — survives a dropped connection and a reload. */
  enabled: boolean;
  running: boolean;
  status: ConnectionStatus;
  reconnectAttempts: number;
  error: string;
  received: number;
  published: number;
};

class Mqtt extends ServiceBase<State> {
  private client: MqttClient | null = null;
  /**
   * Bumped whenever the current client is abandoned. Events carry the
   * generation they were started under, so a connection that dies while its
   * replacement is already connecting cannot report over the live one.
   */
  private generation = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Lookups of a referenced broker's address since it last had one. */
  private mountLookups = 0;
  private countTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      url: "",
      __hkpMount: "",
      mode: "subscribe",
      topics: [],
      topic: "",
      qos: 0,
      retain: false,
      format: "auto",
      username: "",
      password: "",
      clientId: "",
      enabled: false,
      running: false,
      status: "disconnected",
      reconnectAttempts: 0,
      error: "",
      received: 0,
      published: 0,
    });
  }

  configure(config: any): void {
    // What the connection is made of. A change to any of it while connected
    // means the connection in hand is no longer the one described.
    const before = this.connectionKey();
    const changed: Partial<State> = {};
    const set = <K extends keyof State>(key: K, value: State[K]) => {
      if (JSON.stringify(this.state[key]) !== JSON.stringify(value)) {
        this.state[key] = value;
        changed[key] = value;
      }
    };

    if (typeof config.url === "string") {
      set("url", config.url.trim());
    }
    if (typeof config[MOUNT_FIELD] === "string") {
      set("__hkpMount", config[MOUNT_FIELD]);
    }
    if (MODES.includes(config.mode)) {
      set("mode", config.mode);
    }
    const topics = readTopics(config.topics);
    if (topics) {
      set("topics", topics);
    }
    if (typeof config.topic === "string") {
      set("topic", config.topic.trim());
    }
    const qos = readQos(config.qos);
    if (qos !== undefined) {
      set("qos", qos);
    }
    if (typeof config.retain === "boolean") {
      set("retain", config.retain);
    }
    if (FORMATS.includes(config.format)) {
      set("format", config.format);
    }
    if (typeof config.username === "string") {
      set("username", config.username);
    }
    if (typeof config.password === "string") {
      set("password", config.password);
    }
    if (typeof config.clientId === "string") {
      set("clientId", config.clientId.trim());
    }
    if (Object.keys(changed).length) {
      this.app.notify(this, changed);
    }

    // `connect` is a two-way switch; `enabled` is the same switch under the
    // name a restored state uses for it.
    const start =
      config.connect === true ||
      (config.enabled === true && config.connect !== false);
    const stop = config.connect === false || config.enabled === false;

    if (stop) {
      this.stop();
    } else if (start) {
      this.start();
    } else if (this.state.enabled && before !== this.connectionKey()) {
      this.start();
    }
  }

  process(input: any): any {
    if (this.state.mode !== "publish") {
      return input;
    }
    return this.publish(input);
  }

  destroy(): void {
    this.clearReconnectTimer();
    this.abandonClient();
    if (this.countTimer) {
      clearTimeout(this.countTimer);
      this.countTimer = null;
    }
  }

  // ── Publishing ────────────────────────────────────────────────────────────

  /** Publishes one input and answers with it once the broker has it. A
   *  publish that cannot be made says why and passes nothing on. */
  private async publish(input: unknown): Promise<unknown> {
    const message = outgoing(input, {
      topic: this.state.topic,
      qos: this.state.qos,
      retain: this.state.retain,
    });
    const problem = !message
      ? "Nothing says where to publish — set a topic, or send { topic, payload }"
      : topicProblem(message.topic) ||
        (this.client?.connected ? "" : "Not connected to the broker");
    if (!message || problem) {
      this.pushErrorNotification(`MQTT: ${problem}`);
      return null;
    }
    try {
      // Bytes are taken as they are; the declared type asks for the client
      // library's own buffer, which a page has no reason to construct.
      await this.client!.publishAsync(message.topic, message.payload as string, {
        qos: message.qos,
        retain: message.retain,
      });
    } catch (err: any) {
      this.pushErrorNotification(`MQTT: ${String(err?.message ?? err)}`);
      return null;
    }
    this.state.published += 1;
    this.reportCounts();
    return input;
  }

  // ── Connection ────────────────────────────────────────────────────────────

  /** Everything a connection depends on, as one value to compare. */
  private connectionKey(): string {
    const s = this.state;
    return JSON.stringify([
      s.url,
      s.__hkpMount,
      s.mode,
      s.topics,
      s.username,
      s.password,
      s.clientId,
      s.qos,
    ]);
  }

  /**
   * The address to dial, or why there is none.
   *
   * A resolved mount address wins over what was typed, as it does for every
   * consumer of one. A reference is "not resolved yet" rather than something
   * to dial: `waiting` keeps the service enabled until the address is known.
   */
  private target(): { url: string } | { waiting: string } | { problem: string } {
    const { url, __hkpMount: mount } = this.state;
    const held = mount && !parseMountRef(mount) ? mount : "";
    const reference = [mount, url].find((value) => parseMountRef(value));
    // The coordinator writes the address once the owner publishes it; asking
    // covers a connection opened after it was published and before it was
    // written.
    const address =
      held ||
      (reference
        ? (this.app.coordinator?.resolveMountUrl(reference) ?? "")
        : url);
    if (!address || parseMountRef(address)) {
      return reference
        ? { waiting: reference }
        : { problem: "A broker address is required" };
    }
    const { url: dial, problem } = webSocketAddress(address);
    return dial ? { url: dial } : { problem };
  }

  /** Take up the connection, and keep taking it up until told otherwise. */
  private start(): void {
    this.mountLookups = 0;
    this.report({ enabled: true, reconnectAttempts: 0 });
    this.clearReconnectTimer();
    void this.openConnection();
  }

  /** Put the connection down and leave it down. */
  private stop(): void {
    this.clearReconnectTimer();
    this.abandonClient();
    this.report({
      enabled: false,
      running: false,
      status: "disconnected",
      reconnectAttempts: 0,
    });
  }

  /** Gives up on connecting until something is changed, and says why. */
  private fail(problem: string): void {
    this.report({
      enabled: false,
      running: false,
      status: "disconnected",
      error: problem,
    });
  }

  private async openConnection(): Promise<void> {
    if (!this.state.enabled) {
      return;
    }
    this.abandonClient();
    const generation = ++this.generation;

    const target = this.target();
    if ("problem" in target) {
      this.fail(target.problem);
      return;
    }
    this.report({
      running: false,
      status: this.state.reconnectAttempts > 0 ? "reconnecting" : "connecting",
    });
    if ("waiting" in target) {
      // The broker's address has not been published yet: its runtime is still
      // loading, or is not connected. Nothing announces the moment it is, so
      // look again — often at first, when it is usually a matter of the board
      // still restoring, then at leisure.
      this.mountLookups += 1;
      if (this.mountLookups === MOUNT_LOOKUPS_BEFORE_SAYING) {
        this.report({
          error: `Waiting for "${target.waiting}" to publish its address`,
        });
      }
      this.reconnectTimer = setTimeout(
        () => {
          this.reconnectTimer = null;
          void this.openConnection();
        },
        this.mountLookups < MOUNT_LOOKUPS_BEFORE_SAYING
          ? MOUNT_LOOKUP_MS
          : MOUNT_LOOKUP_IDLE_MS,
      );
      return;
    }
    this.mountLookups = 0;
    if (this.state.mode === "subscribe" && !this.state.topics.length) {
      this.fail("Topics are required: say what to subscribe to");
      return;
    }

    // Resolved against the broker being dialled, so a credential bound to one
    // host cannot be sent to another by repointing this service.
    const { value: credentials, problem } = resolveCredential(
      { username: this.state.username, password: this.state.password },
      target.url,
    );
    if (problem) {
      this.fail(problem);
      return;
    }
    if (credentials.password && !credentials.username) {
      this.fail("A password needs a username: MQTT sends none without one");
      return;
    }

    let client: MqttClient;
    try {
      // Loaded when a board first connects: the client library is not small,
      // and most boards never open an MQTT connection.
      const library = await import("mqtt");
      // Named where the bundler kept the library's exports, under `default`
      // where it wrapped a CommonJS build.
      const connect = library.connect ?? library.default?.connect;
      if (typeof connect !== "function") {
        this.fail("The MQTT client library could not be loaded");
        return;
      }
      if (generation !== this.generation || !this.state.enabled) {
        return;
      }
      client = connect(target.url, {
        clientId:
          this.state.clientId ||
          `readymade-${Math.random().toString(16).slice(2, 14)}`,
        clean: true,
        connectTimeout: CONNECT_TIMEOUT_MS,
        // Reconnecting is done here, so that every attempt resolves the
        // address and the credential again.
        reconnectPeriod: 0,
        ...(credentials.username ? { username: credentials.username } : {}),
        ...(credentials.password ? { password: credentials.password } : {}),
      });
    } catch (err) {
      this.onConnectionLost(generation, err);
      return;
    }
    this.client = client;

    let accepted = false;
    client.on("error", (err) => this.onConnectionLost(generation, err));
    client.on("close", () =>
      // A page is told that a WebSocket closed and never why, so say what is
      // likely rather than nothing.
      this.onConnectionLost(
        generation,
        accepted
          ? null
          : new Error(
              "The broker could not be reached, or did not accept the connection — check the address, and the username and password",
            ),
      ),
    );
    client.on("connect", () => {
      accepted = true;
      this.onConnected(client, generation);
    });
    client.on("message", (topic, payload, packet) => {
      if (generation !== this.generation || this.bypass) {
        return;
      }
      this.state.received += 1;
      this.reportCounts();
      // A standing subscription: each message is a pass of its own.
      this.app.next(this, {
        topic,
        payload: decodePayload(payload, this.state.format),
        qos: packet.qos,
        retain: packet.retain,
      });
    });
  }

  private onConnected(client: MqttClient, generation: number): void {
    if (generation !== this.generation) {
      return;
    }
    this.report({
      running: true,
      status: "connected",
      reconnectAttempts: 0,
      error: "",
    });
    if (this.state.mode !== "subscribe") {
      return;
    }
    client.subscribe(this.state.topics, { qos: this.state.qos }, (err, granted) => {
      if (generation !== this.generation) {
        return;
      }
      // 128 and above is the broker declining one filter while taking others.
      const refused = (granted ?? [])
        .filter((grant) => grant.qos >= 128)
        .map((grant) => grant.topic);
      if (err || refused.length) {
        this.report({
          error: err
            ? `Could not subscribe: ${err.message}`
            : `The broker refused ${refused.join(", ")}`,
        });
      }
    });
  }

  /**
   * The current connection is gone. Called more than once for one connection
   * (an error is normally followed by a close), so this is idempotent.
   */
  private onConnectionLost(generation: number, err: unknown): void {
    if (generation !== this.generation) {
      return; // A client already walked away from.
    }
    this.generation += 1;

    const client = this.client;
    this.client = null;
    client?.end(true);

    const error = err
      ? String((err as { message?: unknown })?.message ?? err)
      : this.state.error;
    if (!this.state.enabled) {
      this.report({ running: false, status: "disconnected", error });
      return;
    }

    this.clearReconnectTimer();
    const attempt = this.state.reconnectAttempts + 1;
    // Exponential up to a minute, with jitter so several clients coming back
    // from the same outage do not retry in lockstep.
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** (attempt - 1));
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.report({
      running: false,
      status: "reconnecting",
      reconnectAttempts: attempt,
      error,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Drop the current client without touching what was asked for. */
  private abandonClient(): void {
    this.generation += 1;
    const client = this.client;
    this.client = null;
    // Its listeners stay: a late error from a socket being closed still needs
    // somewhere to go, and the generation makes them say nothing.
    client?.end(true);
  }

  // ── Reporting ─────────────────────────────────────────────────────────────

  /** Takes a change into state and tells whoever is watching. */
  private report(change: Partial<State>): void {
    Object.assign(this.state, change);
    this.app.notify(this, change);
  }

  private reportCounts(): void {
    if (this.countTimer) {
      return;
    }
    this.countTimer = setTimeout(() => {
      this.countTimer = null;
      this.app.notify(this, {
        received: this.state.received,
        published: this.state.published,
      });
    }, COUNT_REPORT_MS);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Mqtt(app, board, descriptor, id),
  createUI: MqttUI,
};

export default descriptor;
