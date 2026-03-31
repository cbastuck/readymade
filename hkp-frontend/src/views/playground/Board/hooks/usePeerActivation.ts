import { useState, useRef, useEffect } from "react";
import {
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
} from "../../../../types";
import { getActivationId, availableDiscoveryPeerHosts } from "../../common";

const defaultDiscoveryPeer = availableDiscoveryPeerHosts[0];

export function usePeerActivation(
  inputRouting: RuntimeInputRoutings,
  outputRouting: RuntimeOutputRoutings
) {
  const [peerOutputActivation, setPeerOutputActivation] =
    useState<RuntimeOutputRoutings>({});
  const [peerInputActivation, setPeerInputActivation] =
    useState<RuntimeInputRoutings>({});

  const updateInputActivation = (inputRoutingArg: RuntimeInputRoutings) => {
    const newActivation = inputRoutingArg
      ? Object.keys(inputRoutingArg).reduce<RuntimeInputRoutings>(
          (all, runtimeId) => {
            const activationId = getActivationId(runtimeId);
            const routing = inputRoutingArg[runtimeId];
            return {
              ...all,
              [activationId]:
                routing?.route?.peer &&
                !routing.hostDescriptor &&
                routing.hostDescriptor !== null
                  ? { ...routing, hostDescriptor: defaultDiscoveryPeer }
                  : routing,
            };
          },
          {}
        )
      : {};
    setPeerInputActivation((state) => ({ ...state, ...newActivation }));
  };

  const updateOutputActivation = (outputRoutingArg: RuntimeOutputRoutings) => {
    const newActivation = outputRoutingArg
      ? Object.keys(outputRoutingArg).reduce<RuntimeOutputRoutings>(
          (all, runtimeId) => {
            const activationId = getActivationId(runtimeId);
            const routing = outputRoutingArg[runtimeId];
            return {
              ...all,
              [activationId]:
                routing?.route?.peer && !routing.hostDescriptor
                  ? { ...routing, hostDescriptor: defaultDiscoveryPeer }
                  : routing,
            };
          },
          {}
        )
      : {};
    setPeerOutputActivation((state) => ({ ...state, ...newActivation }));
  };

  useEffect(() => {
    updateInputActivation(inputRouting);
    updateOutputActivation(outputRouting);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevInputRef = useRef(inputRouting);
  useEffect(() => {
    if (prevInputRef.current !== inputRouting) {
      updateInputActivation(inputRouting);
    }
    prevInputRef.current = inputRouting;
  });

  const prevOutputRef = useRef(outputRouting);
  useEffect(() => {
    if (prevOutputRef.current !== outputRouting) {
      updateOutputActivation(outputRouting);
    }
    prevOutputRef.current = outputRouting;
  });

  return { peerInputActivation, peerOutputActivation };
}
