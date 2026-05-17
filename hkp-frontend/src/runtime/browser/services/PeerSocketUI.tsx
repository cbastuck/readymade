import { useContext, useRef, useState } from "react";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { FacadeDescriptor } from "hkp-frontend/src/facade/types";
import { remapFacadeUuids } from "hkp-frontend/src/views/playground/BoardActions";
import { v4 as uuidv4 } from "uuid";

import { ServiceDescriptor, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import PeersProvider, {
  PeersProviderHandle,
} from "hkp-frontend/src/PeersContext";
import Peer from "hkp-frontend/src/components/Peer";
import { availableDiscoveryPeerHosts } from "hkp-frontend/src/views/playground/common";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import { AppCtx } from "hkp-frontend/src/AppContext";
import Switch from "hkp-frontend/src/ui-components/Switch";

import {
  resolveTemplateVars,
  resolveTemplateVarsInObject,
} from "hkp-frontend/src/templateVars";
import Button from "hkp-frontend/src/ui-components/Button";
import ShareAsQRDialog from "hkp-frontend/src/ui-components/runtime-ui/ShareAsQRDialog";

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
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : null;
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

function buildPartnerBoard(
  peerName: string,
  targetPeer: string,
  peerPort: number | null,
  peerPath: string | null,
  peerHost: string | null,
  peerSecure: boolean | null,
  facade?: FacadeDescriptor,
  originalServices?: ServiceDescriptor[],
): object {
  const runtimeId = "partner-browser";

  const partnerServices = [
    {
      uuid: uuidv4(),
      serviceId: "hookup.to/service/injector",
      serviceName: "Message",
      state: { plainText: true },
    },
    {
      uuid: uuidv4(),
      serviceId: "hookup.to/service/peer-socket",
      serviceName: "Peer Socket",
      state: {
        mode: "Receive and Send",
        peerName: targetPeer,
        targetPeer: peerName,
        extractIncomingData: true,
        peerPort,
        peerPath,
        peerHost,
        peerSecure,
      },
    },
    {
      uuid: uuidv4(),
      serviceId: "hookup.to/service/monitor",
      serviceName: "Messages",
    },
    {
      uuid: uuidv4(),
      serviceId: "hookup.to/service/stopper",
      serviceName: "Stopper",
    },
  ];

  const board: any = {
    boardName: "Partner",
    runtimes: [{ id: runtimeId, name: "Browser", type: "browser" }],
    services: { [runtimeId]: partnerServices },
  };

  if (facade) {
    if (originalServices) {
      // Map original uuid → new uuid by matching serviceId
      const uuidMap = new Map<string, string>();
      for (const newSvc of partnerServices) {
        const orig = originalServices.find((s) => s.serviceId === newSvc.serviceId);
        if (orig) {
          uuidMap.set(orig.uuid, newSvc.uuid);
        }
      }
      board.facade = remapFacadeUuids(facade, uuidMap);
    } else {
      board.facade = facade;
    }
  }

  return resolveTemplateVarsInObject(board);
}

export default function PeerSocketUI(props: ServiceUIProps) {
  const boardContext = useBoardContext();
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
  const [partnerQRSource, setPartnerQRSource] = useState<object | null>(null);

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
  const activePeerPort = isCustomServer ? (peerPort ?? undefined) : hostDescriptor?.port;
  const activePeerPath = isCustomServer ? (peerPath ?? "/") : hostDescriptor?.path;
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
  const onSharePartnerQR = () => {
    const allOriginalServices = Object.values(boardContext?.services ?? {}).flat();
    setPartnerQRSource(
      buildPartnerBoard(peerName, targetPeer, peerPort, peerPath, peerHost, peerSecure, boardContext?.facade, allOriginalServices),
    );
  };

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
                props.service.configure({ peerHost: null, peerPort: null, peerPath: null, peerSecure: null });
              } else {
                const { host, port, path, secure } = parseServerUrl(trimmed);
                props.service.configure({ peerHost: host, peerPort: port, peerPath: path, peerSecure: secure });
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
                  <SubmittableInput
                    fullWidth
                    title="Send to"
                    value={targetPeer}
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

          {isSendAllowed && (
            <Button className="hkp-svc-btn px-1" onClick={onSharePartnerQR}>
              Create peered partner board
            </Button>
          )}

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

      <ShareAsQRDialog
        isOpen={partnerQRSource !== null}
        runtimeSource={partnerQRSource}
        onClose={() => setPartnerQRSource(null)}
      />
    </ServiceUI>
  );
}
