import { useContext, useRef, useState } from "react";
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

import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import { AppCtx } from "hkp-frontend/src/AppContext";
import Switch from "hkp-frontend/src/ui-components/Switch";

import {
  resolveTemplateVars,
  resolveTemplateVarsInObject,
} from "hkp-frontend/src/templateVars";
import Button from "hkp-frontend/src/ui-components/Button";
import ShareAsQRDialog from "hkp-frontend/src/ui-components/runtime-ui/ShareAsQRDialog";

function buildPartnerBoard(
  peerName: string,
  targetPeer: string,
  peerPort: number | null,
  peerPath: string | null,
  peerHost: string | null,
): object {
  const runtimeId = "partner-browser";
  const board = {
    boardName: "Partner",
    runtimes: [{ id: runtimeId, name: "Browser", type: "browser" }],
    services: {
      [runtimeId]: [
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
      ],
    },
  };
  return resolveTemplateVarsInObject(board);
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

  // Resolve the active peer host/port/path.
  // When peerPort is configured in state (local PeerServer), derive the host
  // from HKP_RUNTIME_URL (available on the Meander host) or use explicit peerHost.
  // Fall back to the classic discovery hosts when no peerPort is set.
  const resolvedPeerHost = peerHost ? resolveTemplateVars(peerHost) : null;
  const activePeerHost =
    peerPort !== null
      ? (resolvedPeerHost ?? hostDescriptor?.host)
      : hostDescriptor?.host;
  const activePeerPort = peerPort !== null ? peerPort : hostDescriptor?.port;
  const activePeerPath =
    peerPort !== null ? (peerPath ?? "/") : hostDescriptor?.path;
  const activePeerSecure = peerPort !== null ? false : hostDescriptor?.secure;

  const isSendAllowed = currentMode !== "Receive only";
  const isReceivedAllowed = currentMode !== "Send only";
  const onRandomPeerName = () => setPeerName(uuidv4());
  const onRandomTargetPeer = () => setTargetPeer(uuidv4());
  const onSwap = () => {
    props.service.configure({ peerName: targetPeer, targetPeer: peerName });
  };
  const onSharePartnerQR = () => {
    setPartnerQRSource(
      buildPartnerBoard(peerName, targetPeer, peerPort, peerPath, peerHost),
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
                  className="px-1 h-[20px] mb-1"
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
                    className="px-1 h-[20px] mb-1"
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
                className="px-1 self-stretch w-6 mb-1"
                onClick={onSwap}
              >
                ⇅
              </Button>
            )}
          </div>

          {isSendAllowed && (
            <Button className="px-1" onClick={onSharePartnerQR}>
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
              key={`${activePeerHost}:${activePeerPort}${activePeerPath}`}
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
