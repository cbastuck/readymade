import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import ComboInput from "hkp-frontend/src/ui-components/ComboInput";

import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import Switch from "hkp-frontend/src/ui-components/Switch";

import Button from "hkp-frontend/src/ui-components/Button";
import { resolveActivePeerHost } from "./PeerConnection";

function parseServerUrl(input: string): {
  host: string;
  port: number | null;
  path: string | null;
  secure: boolean;
} {
  let url = input.trim();
  if (!url.includes("://")) {
    url = "ws://" + url;
  }
  try {
    const parsed = new URL(url);
    const secure = parsed.protocol === "wss:";
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : null;
    const path =
      parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : null;
    return { host, port, path, secure };
  } catch {
    return { host: input.trim(), port: null, path: null, secure: false };
  }
}

function formatServerUrl(
  host: string,
  port: number | null,
  path: string | null,
  secure: boolean,
): string {
  const scheme = secure ? "wss" : "ws";
  const defaultPort = secure ? 443 : 80;
  const portStr = port !== null && port !== defaultPort ? `:${port}` : "";
  const pathStr = !path || path === "/" ? "" : path;
  return `${scheme}://${host}${portStr}${pathStr}`;
}

/**
 * Outcome of the last peer-list lookup. The list is only fetched when the user
 * opens the dropdown, so "idle" means nobody has asked yet.
 */
type PeerListStatus =
  | "idle"
  | "loading"
  | "ready"
  | "off"
  | "prohibited"
  | "declined"
  | "error";

const PEER_LIST_HINTS: Record<PeerListStatus, string> = {
  idle: "Open to look up peers",
  loading: "Looking up peers…",
  ready: "No peers found",
  off: "Peer lookup is switched off",
  prohibited: "Peer discovery is disabled for this server",
  declined: "This server does not publish its peer list",
  error: "Could not reach the peer server",
};

export default function PeerSocketUI(props: ServiceUIProps) {
  const [peerName, setPeerName] = useState("");
  const [targetPeer, setTargetPeer] = useState("");
  const [currentMode, setCurrentMode] = useState("");
  const [extractIncomingData, setExtractIncomingData] = useState(false);
  const [peerPort, setPeerPort] = useState<number | null>(null);
  const [peerPath, setPeerPath] = useState<string | null>(null);
  const [peerHost, setPeerHost] = useState<string | null>(null);
  const [peerSecure, setPeerSecure] = useState<boolean | null>(null);
  const [mount, setMount] = useState<string | null>(null);
  const [availablePeers, setAvailablePeers] = useState<string[]>([]);
  const [peerListStatus, setPeerListStatus] = useState<PeerListStatus>("idle");
  const [peerDiscovery, setPeerDiscovery] = useState(true);

  // This panel is a pure view: it reflects service state and issues configure()
  // calls. The live peer connection is owned by the PeerSocket service, so it
  // keeps running whether or not this panel is mounted.
  const update = (state: any) => {
    if (needsUpdate(state.peerName, peerName)) {
      setPeerName(state.peerName);
    }
    if (needsUpdate(state.targetPeer, targetPeer)) {
      setTargetPeer(state.targetPeer);
    }
    if (needsUpdate(state.mode, currentMode)) {
      setCurrentMode(state.mode);
    }
    if (needsUpdate(state.extractIncomingData, extractIncomingData)) {
      setExtractIncomingData(state.extractIncomingData);
    }
    if (needsUpdate(state.peerPort, peerPort)) {
      setPeerPort(state.peerPort);
    }
    if (needsUpdate(state.peerPath, peerPath)) {
      setPeerPath(state.peerPath);
    }
    if (needsUpdate(state.peerHost, peerHost)) {
      setPeerHost(state.peerHost);
    }
    if (needsUpdate(state.peerSecure, peerSecure)) {
      setPeerSecure(state.peerSecure);
    }
    if (needsUpdate(state.__hkpMount, mount)) {
      setMount(state.__hkpMount);
    }
    if (needsUpdate(state.peerDiscovery, peerDiscovery)) {
      setPeerDiscovery(state.peerDiscovery);
    }
  };

  const onInit = (state: any) => update(state);
  const onNotification = (notification: any) => update(notification);

  const onChangeMode = (newMode: string) => {
    props.service.configure({ mode: newMode });
  };

  // Resolve the active server the same way the service does, so the displayed
  // URL and the fetched peer list match the connection the service holds. Null
  // means a Peer Server reference whose runtime has not published an endpoint
  // yet, which is a normal state during board load.
  const activeHost = resolveActivePeerHost(
    { peerHost, peerPort, peerPath, peerSecure, __hkpMount: mount },
    (props.service as any)?.app?.coordinator,
  );

  const serverDisplayValue = activeHost?.host
    ? formatServerUrl(
        activeHost.host,
        activeHost.port ?? null,
        activeHost.path,
        activeHost.secure,
      )
    : mount
      ? `${mount} (waiting for endpoint)`
      : "";

  const isSendAllowed = currentMode !== "Receive only";
  const onRandomPeerName = () => setPeerName(uuidv4());
  const onRandomTargetPeer = () => setTargetPeer(uuidv4());
  const onSwap = () => {
    props.service.configure({ peerName: targetPeer, targetPeer: peerName });
  };

  // Asking a signalling server who is connected to it is a request some
  // operators would rather not receive, and its outcome is worth reporting
  // either way — an empty dropdown alone cannot say whether there are no peers,
  // the server declined, or it was unreachable.
  const fetchAvailablePeers = useCallback(async () => {
    if (!activeHost?.host) {
      return;
    }
    if (!peerDiscovery) {
      // Switched off locally: this is the lever for hand-configured servers,
      // which have no descriptor to carry an opt-out.
      setAvailablePeers([]);
      setPeerListStatus("off");
      return;
    }
    if (!activeHost.discoverable) {
      // Prohibited for this server: answer from the descriptor without letting
      // a request leave the client.
      setAvailablePeers([]);
      setPeerListStatus("prohibited");
      return;
    }

    const protocol = activeHost.secure ? "https" : "http";
    const defaultPort = activeHost.secure ? 443 : 80;
    const portStr =
      activeHost.port && activeHost.port !== defaultPort
        ? `:${activeHost.port}`
        : "";
    const basePath = activeHost.path ?? "/";
    const peersPath = basePath.endsWith("/")
      ? `${basePath}peerjs/peers`
      : `${basePath}/peerjs/peers`;
    const url = `${protocol}://${activeHost.host}${portStr}${peersPath}`;

    setPeerListStatus("loading");
    try {
      const response = await fetch(url);
      if (response.ok) {
        const peers: string[] = await response.json();
        setAvailablePeers(peers);
        setPeerListStatus("ready");
        return;
      }
      setAvailablePeers([]);
      // A refusal is the server's policy, not a fault — worth telling apart
      // from a server that could not be reached at all.
      setPeerListStatus(
        response.status === 401 || response.status === 403
          ? "declined"
          : "error",
      );
    } catch {
      setAvailablePeers([]);
      setPeerListStatus("error");
    }
  }, [
    activeHost?.host,
    activeHost?.port,
    activeHost?.path,
    activeHost?.secure,
    activeHost?.discoverable,
    peerDiscovery,
  ]);

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <div className="flex flex-col gap-2">
        <RadioGroup
          title="Mode"
          options={["Receive only", "Send only", "Receive and Send"]}
          value={currentMode}
          onChange={onChangeMode}
        />
        <SubmittableInput
          fullWidth
          title="PeerJS Server"
          value={serverDisplayValue}
          onSubmit={(value) => {
            const trimmed = value.trim();
            // Typing a server here is an explicit override, so it also drops any
            // Peer Server reference — otherwise the reference would keep winning
            // and the typed value would appear to be ignored.
            if (!trimmed) {
              props.service.configure({
                peerHost: null,
                peerPort: null,
                peerPath: null,
                peerSecure: null,
                __hkpMount: null,
              });
            } else {
              const { host, port, path, secure } = parseServerUrl(trimmed);
              props.service.configure({
                peerHost: host,
                peerPort: port,
                peerPath: path,
                peerSecure: secure,
                __hkpMount: null,
              });
            }
          }}
        />
        <div className="flex items-stretch gap-1">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-end">
              <SubmittableInput
                fullWidth
                title="My Name"
                value={peerName}
                onSubmit={(peerName) => props.service.configure({ peerName })}
              />
              <Button
                className="hkp-svc-btn px-1 h-[20px] mb-1"
                onClick={onRandomPeerName}
              >
                Random
              </Button>
            </div>

            {isSendAllowed && (
              <div className="flex items-end">
                <ComboInput
                  title="Send to"
                  value={targetPeer}
                  options={availablePeers.filter((p) => p !== peerName)}
                  emptyHint={PEER_LIST_HINTS[peerListStatus]}
                  onOpen={fetchAvailablePeers}
                  onSubmit={(targetPeer) =>
                    props.service.configure({ targetPeer })
                  }
                />
                <Button
                  className="hkp-svc-btn px-1 h-[20px] mb-1"
                  onClick={onRandomTargetPeer}
                >
                  Random
                </Button>
              </div>
            )}
          </div>

          {isSendAllowed && (
            <Button
              size={null}
              className="hkp-svc-btn px-1 self-stretch w-6 mb-1"
              onClick={onSwap}
            >
              ⇅
            </Button>
          )}
        </div>

        {currentMode !== "Send only" && (
          <Switch
            title="Unpack received data"
            checked={extractIncomingData}
            onCheckedChange={(newChecked) =>
              props.service.configure({ extractIncomingData: newChecked })
            }
          />
        )}

        {isSendAllowed && (
          <Switch
            title="Discovery"
            checked={peerDiscovery}
            onCheckedChange={(newChecked) =>
              props.service.configure({ peerDiscovery: newChecked })
            }
          />
        )}
      </div>
    </ServiceUI>
  );
}
