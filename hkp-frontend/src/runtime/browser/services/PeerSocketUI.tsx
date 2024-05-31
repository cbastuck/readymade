import { useRef, useState } from "react";

import { ServiceUIProps } from "@/types";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import PeersProvider from "@/PeersContext";
import Peer from "@/components/Peer";
import { availableDiscoveryPeerHosts } from "@/views/playground/common";
import SubmittableInput from "@/ui-components/SubmittableInput";
import { generateRandomName } from "@/core/board";
import RadioGroup from "@/ui-components/RadioGroup";

export default function PeerSocketUI(props: ServiceUIProps) {
  const [bypass, setBypass] = useState(false);
  const [peerName, setPeerName] = useState(generateRandomName());
  const [targetPeer, setTargetPeer] = useState("");
  const [currentMode, setCurrentMode] = useState("");

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
  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <PeersProvider ref={(p) => (provider.current = p)}>
        <div className="flex flex-col gap-2">
          <SubmittableInput
            fullWidth
            title="My Name"
            value={peerName}
            onSubmit={(peerName) => props.service.configure({ peerName })}
          />
          <RadioGroup
            title="Mode"
            options={["Receive only", "Send only", "Receive and Send"]}
            value={currentMode}
            onChange={onChangeMode}
          />
          {currentMode !== "Receive only" && (
            <SubmittableInput
              fullWidth
              title="Target name"
              value={targetPeer}
              onSubmit={(targetPeer) => props.service.configure({ targetPeer })}
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
          />
        </div>
      </PeersProvider>
    </ServiceUI>
  );
}
