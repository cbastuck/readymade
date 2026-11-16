/**
 * How an MQTT message's bytes become a pipeline value and back, and what an
 * input says about where it is published.
 *
 * The same reading hkp-node's `mqtt` and `mqtt-broker` give
 * (`hkp-node/src/services/mqtt-message.ts`), so a board sees one shape
 * whichever runtime its MQTT service runs on.
 */

export const MODES = ["subscribe", "publish"] as const;
export type Mode = (typeof MODES)[number];

export type MqttQos = 0 | 1 | 2;

/** How a received payload enters the pipeline. */
export const FORMATS = ["auto", "text", "binary"] as const;
export type PayloadFormat = (typeof FORMATS)[number];

/** One message to publish. */
export type Outgoing = {
  topic: string;
  payload: string | Uint8Array;
  qos: MqttQos;
  retain: boolean;
};

export function readQos(value: unknown): MqttQos | undefined {
  return value === 0 || value === 1 || value === 2 ? value : undefined;
}

/**
 * Topic filters, from a list or from one string naming several: a board
 * written by hand says `"a/#, b/+/c"` as readily as an array.
 */
export function readTopics(value: unknown): string[] | undefined {
  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : undefined;
  if (!entries) {
    return undefined;
  }
  return [
    ...new Set(
      entries
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * A received payload as a pipeline value. `auto` is JSON where the bytes are
 * JSON and the text otherwise; `binary` keeps the bytes.
 */
export function decodePayload(
  payload: Uint8Array,
  format: PayloadFormat,
): unknown {
  if (format === "binary") {
    // A plain copy: what arrives is the client library's own buffer type.
    return new Uint8Array(payload);
  }
  const text = new TextDecoder().decode(payload);
  if (format === "text") {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A pipeline value as what is published: text as it is, bytes as they are,
 *  anything else as JSON. Nothing at all is an empty payload, which is how
 *  MQTT clears a retained message. */
export function encodePayload(value: unknown): string | Uint8Array {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return JSON.stringify(value);
}

/**
 * What an input is published as.
 *
 * An input shaped `{ topic, payload }` names its own topic — and may say `qos`
 * and `retain`. Any other input is the payload, published under the
 * configured topic. Null when neither names a topic.
 */
export function outgoing(
  input: unknown,
  defaults: { topic: string; qos: MqttQos; retain: boolean },
): Outgoing | null {
  if (
    input &&
    typeof input === "object" &&
    !(input instanceof Uint8Array) &&
    !(input instanceof ArrayBuffer) &&
    typeof (input as { topic?: unknown }).topic === "string" &&
    "payload" in input
  ) {
    const named = input as {
      topic: string;
      payload: unknown;
      qos?: unknown;
      retain?: unknown;
    };
    const topic = named.topic.trim();
    if (!topic) {
      return null;
    }
    return {
      topic,
      payload: encodePayload(named.payload),
      qos: readQos(named.qos) ?? defaults.qos,
      retain: typeof named.retain === "boolean" ? named.retain : defaults.retain,
    };
  }
  if (!defaults.topic) {
    return null;
  }
  return {
    topic: defaults.topic,
    payload: encodePayload(input),
    qos: defaults.qos,
    retain: defaults.retain,
  };
}

/** Why a topic cannot be published under, or nothing when it can. */
export function topicProblem(topic: string): string {
  if (/[#+]/.test(topic)) {
    return `"${topic}" is a filter, not a topic: + and # only subscribe`;
  }
  return "";
}

/**
 * A broker address as a WebSocket address, or why the browser cannot dial it.
 *
 * A page opens WebSockets and nothing else, so `mqtt://` and `mqtts://` — MQTT
 * over a plain socket — are a Node runtime's to reach. A mount's address is
 * `http(s)://…`: the same endpoint, spoken to as a WebSocket.
 */
export function webSocketAddress(
  address: string,
): { url: string; problem: "" } | { url: ""; problem: string } {
  let parsed: URL;
  try {
    parsed = new URL(address.trim());
  } catch {
    return {
      url: "",
      problem: `"${address}" is not a broker address: write ws://host/path or wss://host/path`,
    };
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return {
      url: "",
      problem: /^(mqtts?|tcp|ssl|tls):$/.test(parsed.protocol)
        ? "A browser reaches a broker only over WebSockets: use the broker's ws:// or wss:// address, or move this service to a Node runtime"
        : `"${address}" is not a broker address: write ws://host/path or wss://host/path`,
    };
  }
  return { url: parsed.toString(), problem: "" };
}
