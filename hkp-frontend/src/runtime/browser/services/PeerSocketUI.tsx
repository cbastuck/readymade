import { useContext, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { CustomMenuEntry, ServiceUIProps } from "hkp-frontend/src/types";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import PeersProvider from "hkp-frontend/src/PeersContext";
import Peer from "hkp-frontend/src/components/Peer";
import { availableDiscoveryPeerHosts } from "hkp-frontend/src/views/playground/common";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import { AppCtx } from "hkp-frontend/src/AppContext";
import Switch from "hkp-frontend/src/ui-components/Switch";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";

import peerSocketReceiverTemplate from "./PeerSocketReceiverTemplate.json";
import { createBoardLink } from "hkp-frontend/src/views/playground/BoardLink";
import { replacePlaceholders } from "hkp-frontend/src/core/url";
import Button from "hkp-frontend/src/ui-components/Button";

export default function PeerSocketUI(props: ServiceUIProps) {
  const [bypass, setBypass] = useState(false);
  const [peerName, setPeerName] = useState("");
  const [targetPeer, setTargetPeer] = useState("");
  const [currentMode, setCurrentMode] = useState("");
  const [extractIncomingData, setExtractIncomingData] = useState(false);

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
  };

  const onInit = (state: any) => update(state);
  const onNotification = (notification: any) => update(notification);

  const provider = useRef<PeersProvider | null>(null);
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

  const [receiverBoardUrl, setReceiverBoardUrl] = useState<string | null>(null);
  const onCreateReceiverBoard = () => {
    const substitutes = {
      "receiver-name": targetPeer,
    };
    const url = createBoardLink(
      replacePlaceholders(
        JSON.stringify(peerSocketReceiverTemplate),
        substitutes
      )
    );
    setReceiverBoardUrl(url);
  };

  const isSendAllowed = currentMode !== "Receive only";
  const isReceivedAllowed = currentMode !== "Send only";
  const customMenuEntries: Array<CustomMenuEntry> = [
    {
      name: "Create Receiver Board QR",
      icon: <MenuIcon icon={QrCode} />,
      disabled: !isSendAllowed,
      onClick: onCreateReceiverBoard,
    },
  ];
  const onRandomPeerName = () => setPeerName(uuidv4());
  const onRandomTargetPeer = () => setTargetPeer(uuidv4());
  return (
    <ServiceUI
      className="pb-4"
      {...props}
      customMenuEntries={customMenuEntries}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <PeersProvider ref={(p) => (provider.current = p)}>
        <div className="flex flex-col gap-2">
          <RadioGroup
            title="Mode"
            options={["Receive only", "Send only", "Receive and Send"]}
            value={currentMode}
            onChange={onChangeMode}
          />
          <div className="flex items-end">
            <SubmittableInput
              fullWidth
              title="My Name"
              value={peerName}
              onSubmit={(peerName) => props.service.configure({ peerName })}
            />
            <Button className="px-1 h-[20px] mb-1" onClick={onRandomPeerName}>
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

          {isReceivedAllowed && (
            <Switch
              title="Unpack received data"
              checked={extractIncomingData}
              onCheckedChange={(newChecked) =>
                props.service.configure({ extractIncomingData: newChecked })
              }
            />
          )}

          <Peer
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
            peerHost={hostDescriptor?.host}
            usePeerPort={hostDescriptor?.port}
            usePeerRoutePath={hostDescriptor?.path}
            isSecure={hostDescriptor?.secure}
            onError={onError}
          />
        </div>
        <ShareQRCodeDialog
          title="Receiver Board"
          isOpen={receiverBoardUrl !== null}
          url={receiverBoardUrl}
          onClose={() => setReceiverBoardUrl(null)}
        />
      </PeersProvider>
    </ServiceUI>
  );
}
