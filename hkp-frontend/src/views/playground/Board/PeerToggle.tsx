import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import Button from "hkp-frontend/src/ui-components/Button";
import {
  PeerJsHostDescriptor,
  RuntimeDescriptor,
  RuntimeInputOptions,
  RuntimeInputRoutings,
  RuntimeOutputOptions,
  RuntimeOutputRoutings,
} from "../../../types";
import { availableDiscoveryPeerHosts, getActivationId } from "../common";

function formatHostAndPort(peer: PeerJsHostDescriptor) {
  const { host, port, secure } = peer;
  return `${secure ? "wss" : "ws"}://${host}:${port}`;
}

const defaultDiscoveryPeer = availableDiscoveryPeerHosts[0];

type Props = {
  runtime: RuntimeDescriptor;
  type: "input" | "output";
  peerInputActivation: RuntimeInputRoutings;
  peerOutputActivation: RuntimeOutputRoutings;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeInputOptions
  ) => void;
  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeOutputOptions
  ) => void;
};

/**
 * Renders either the peer-discovery activation panel (when no host is set)
 * or the disable button (when a host is active), for one runtime's input or output.
 */
export default function PeerToggle({
  runtime,
  type,
  peerInputActivation,
  peerOutputActivation,
  onChangeInputRouting,
  onChangeOutputRouting,
}: Props) {
  const activationId = getActivationId(runtime.id);
  const inputActivation = peerInputActivation[activationId];
  const outputActivation = peerOutputActivation[activationId];

  const hasHost =
    type === "input"
      ? !!inputActivation?.hostDescriptor
      : !!outputActivation?.hostDescriptor;

  // Deactivator — shown when a host is already set
  if (hasHost) {
    return (
      <div className={type === "input" ? "mr-2 mb-2" : "mx-2 mb-2"}>
        <Button
          className="w-full"
          onClick={() => {
            if (type === "input") {
              onChangeInputRouting(runtime, {
                ...(inputActivation || {}),
                hostDescriptor: null,
              });
            } else if (outputActivation) {
              onChangeOutputRouting(runtime, {
                ...outputActivation,
                route: { peer: null },
                hostDescriptor: null,
              });
            }
          }}
        >
          Click to disable
        </Button>
      </div>
    );
  }

  // Activator — shown when no host is set yet
  const discoveryOptions = availableDiscoveryPeerHosts.reduce<
    Record<string, string>
  >((acc, peer) => {
    const label = formatHostAndPort(peer);
    return { ...acc, [label]: label };
  }, {});

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        width: 300,
      }}
    >
      <div
        className="font-sans-clean text-base tracking-widest leading-2"
        style={{ paddingBottom: 5 }}
      >
        Receive or send data from or to a peer runtime. Activate peer discovery
        via:
      </div>
      <SelectorField
        label="URL"
        value={formatHostAndPort(defaultDiscoveryPeer)}
        options={discoveryOptions}
        onChange={({ index }) => {
          if (index === undefined) return;
          if (type === "output") {
            onChangeOutputRouting(runtime, {
              route: outputActivation?.route ?? { peer: null },
              hostDescriptor: availableDiscoveryPeerHosts[index],
              flow: outputActivation?.flow ?? "pass",
            });
          } else {
            onChangeInputRouting(runtime, {
              route: inputActivation?.route ?? { peer: null },
              hostDescriptor: availableDiscoveryPeerHosts[index],
            });
          }
        }}
        uppercaseValues={false}
      />
      <Button
        className="mr-2 my-2"
        onClick={() => {
          if (type === "output") {
            onChangeOutputRouting(runtime, {
              route: outputActivation?.route ?? { peer: null },
              hostDescriptor: defaultDiscoveryPeer,
              flow: outputActivation?.flow ?? "pass",
            });
          } else {
            onChangeInputRouting(runtime, {
              route: { peer: null },
              hostDescriptor: defaultDiscoveryPeer,
            });
          }
        }}
      >
        Click to enable
      </Button>
    </div>
  );
}
