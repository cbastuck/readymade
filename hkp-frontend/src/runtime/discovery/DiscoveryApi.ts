import { RuntimeClass } from "../../types";

// A Meander instance found on the local network during a discover window.
// Mirrors the C++ DiscoveredPeer struct (hkp-rt/lib/src/discovery/discovery.h).
export type DiscoveredPeer = {
  id: string;
  name: string;
  platform: string;
  host: string;
  port: number;
  board: string;
};

export type DiscoverState = {
  active: boolean;
  endsAt: number; // epoch ms; 0 when inactive
  peers: DiscoveredPeer[];
};

// Resolves the base URL of *this* instance's local runtime, where the discovery
// endpoints live. Loopback always works because the runtime binds either
// 0.0.0.0 (LAN) or 127.0.0.1 (local-only) — both include 127.0.0.1.
function localRuntimeBaseUrl(): string | null {
  const cfg = (window as any).__MEANDER_CONFIG__;
  if (!cfg) {
    return null;
  }
  if (cfg.runtimeBaseURL) {
    return String(cfg.runtimeBaseURL).replace(/\/+$/, "");
  }
  if (cfg.runtimePort) {
    return `http://127.0.0.1:${cfg.runtimePort}`;
  }
  return null;
}

// True when running inside a Meander host that exposes a local runtime, i.e.
// when discovery is usable at all (it is not available in a plain browser).
export function isDiscoverySupported(): boolean {
  return localRuntimeBaseUrl() !== null;
}

async function discoverFetch(
  method: "POST" | "GET" | "DELETE",
  body?: unknown,
): Promise<DiscoverState> {
  const base = localRuntimeBaseUrl();
  if (!base) {
    throw new Error("Discovery is only available in the Meander app");
  }
  const res = await fetch(`${base}/discover`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Discovery request failed (${res.status})`);
  }
  return (await res.json()) as DiscoverState;
}

// Opens a transient discover window of `durationSeconds` (server clamps 5–120)
// and returns the initial state. Poll getDiscoverState() while it is active.
export function startDiscover(durationSeconds = 30): Promise<DiscoverState> {
  return discoverFetch("POST", { durationSeconds });
}

export function getDiscoverState(): Promise<DiscoverState> {
  return discoverFetch("GET");
}

export function stopDiscover(): Promise<DiscoverState> {
  return discoverFetch("DELETE");
}

// Converts a discovered peer into a REST runtime engine ready to register.
export function peerToRuntimeClass(peer: DiscoveredPeer): RuntimeClass {
  return {
    type: "rest",
    name: peer.name || `${peer.host}:${peer.port}`,
    url: `http://${peer.host}:${peer.port}`,
  };
}
