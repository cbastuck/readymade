import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import PeersProvider, {
  PeersProviderHandle,
} from "hkp-frontend/src/PeersContext";
import Peer from "hkp-frontend/src/components/Peer";
import { availableDiscoveryPeerHosts } from "hkp-frontend/src/views/playground/common";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import ComboInput from "hkp-frontend/src/ui-components/ComboInput";

import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import { AppCtx } from "hkp-frontend/src/AppContext";
import Switch from "hkp-frontend/src/ui-components/Switch";

import { resolveTemplateVars } from "hkp-frontend/src/templateVars";
import Button from "hkp-frontend/src/ui-components/Button";

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

export default function PeerSocketUI(props: ServiceUIProps) {
  const [initialized, setInitialized] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [peerName, setPeerName] = useState("");
  const [targetPeer, setTargetPeer] = useState("");
  const [currentMode, setCurrentMode] = useState("");
  const [extractIncomingData, setExtractIncomingData] = useState(false);
  const [peerPort, setPeerPort] = useState<number | null>(null);
  const [peerPath, setPeerPath] = useState<string | null>(null);
  const [peerHost, setPeerHost] = useState<string | null>(null);
  const [peerSecure, setPeerSecure] = useState<boolean | null>(null);
  const [availablePeers, setAvailablePeers] = useState<string[]>([]);

  const update = (state: any) => {
    if (needsUpdate(state.bypass, bypass)) {
      setBypass(state.bypass);
    }
    if (state.data !== undefined) {
      sendData(state.data);
    }
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
  };

  const onInit = (state: any) => {
    update(state);
    setInitialized(true);
  };
  const onNotification = (notification: any) => update(notification);

  const provider = useRef<PeersProviderHandle | null>(null);
  const sendData = (data: any) => {
    if (provider.current && targetPeer) {
      provider.current.sendData(peerName, targetPeer, data);
    }
  };

  const onChangeMode = (newMode: string) => {
    props.service.configure({ mode: newMode });
  };
  const hostDescriptor = availableDiscoveryPeerHosts[0];
  const appContext = useContext(AppCtx);
  const onError = (error: Error) =>
    appContext?.pushNotification({
      type: "error",
      message: error.message,
    });

  // Resolve the active peer host/port/path/secure.
  // When peerHost or peerPort is configured, use those values (custom server).
  // Fall back to the first discovery host when neither is set.
  const resolvedPeerHost = peerHost ? resolveTemplateVars(peerHost) : null;
  const isCustomServer = peerHost !== null || peerPort !== null;
  const activePeerHost = isCustomServer
    ? (resolvedPeerHost ?? hostDescriptor?.host)
    : hostDescriptor?.host;
  const activePeerPort = isCustomServer
    ? (peerPort ?? undefined)
    : hostDescriptor?.port;
  const activePeerPath = isCustomServer
    ? (peerPath ?? "/")
    : hostDescriptor?.path;
  const activePeerSecure = isCustomServer
    ? (peerSecure ?? false)
    : hostDescriptor?.secure;

  const serverDisplayValue = activePeerHost
    ? formatServerUrl(
        activePeerHost,
        activePeerPort ?? null,
        activePeerPath ?? null,
        activePeerSecure ?? false,
      )
    : "";

  const isSendAllowed = currentMode !== "Receive only";
  const isReceivedAllowed = currentMode !== "Send only";
  const onRandomPeerName = () => setPeerName(uuidv4());
  const onRandomTargetPeer = () => setTargetPeer(uuidv4());
  const onSwap = () => {
    props.service.configure({ peerName: targetPeer, targetPeer: peerName });
  };

  const fetchAvailablePeers = useCallback(async () => {
    if (!activePeerHost) {
      return;
    }
    const protocol = activePeerSecure ? "https" : "http";
    const defaultPort = activePeerSecure ? 443 : 80;
    const portStr =
      activePeerPort && activePeerPort !== defaultPort
        ? `:${activePeerPort}`
        : "";
    const basePath = activePeerPath ?? "/";
    const peersPath = basePath.endsWith("/")
      ? `${basePath}peerjs/peers`
      : `${basePath}/peerjs/peers`;
    const url = `${protocol}://${activePeerHost}${portStr}${peersPath}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const peers: string[] = await response.json();
        setAvailablePeers(peers);
      }
    } catch {
      // peer list is optional — ignore network errors
    }
  }, [activePeerHost, activePeerPort, activePeerPath, activePeerSecure]);

  useEffect(() => {
    fetchAvailablePeers();
  }, [fetchAvailablePeers]);

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <PeersProvider ref={provider}>
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
              if (!trimmed) {
                props.service.configure({
                  peerHost: null,
                  peerPort: null,
                  peerPath: null,
                  peerSecure: null,
                });
              } else {
                const { host, port, path, secure } = parseServerUrl(trimmed);
                props.service.configure({
                  peerHost: host,
                  peerPort: port,
                  peerPath: path,
                  peerSecure: secure,
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

          {isReceivedAllowed && (
            <Switch
              title="Unpack received data"
              checked={extractIncomingData}
              onCheckedChange={(newChecked) =>
                props.service.configure({ extractIncomingData: newChecked })
              }
            />
          )}

          {initialized && !bypass && (
            <Peer
              key={`${activePeerSecure ? "wss" : "ws"}://${activePeerHost}:${activePeerPort}${activePeerPath}`}
              name={peerName}
              onData={(envelope) => {
                if (currentMode !== "Send only") {
                  props.service.configure({ incoming: envelope });
                }
              }}
              onConnectionClosed={(closedPeer) => {
                console.log("Connection closed to", closedPeer);
              }}
              active={true}
              peerHost={activePeerHost}
              usePeerPort={activePeerPort}
              usePeerRoutePath={activePeerPath}
              isSecure={activePeerSecure}
              onError={onError}
            />
          )}
        </div>
      </PeersProvider>
    </ServiceUI>
  );
}
