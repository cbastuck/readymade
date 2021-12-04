import React, { Component } from "react";

import Peer from "../../components/Peer";
import PeersProvider, { PeersConsumer } from "../../PeersContext";
import SelectorField from "../../components/shared/SelectorField";
import { syncBoard } from "../../core/sync";

const SYNC_BOARD_PREFIX = "board-peer";

export default class PeerSync extends Component {
  state = {
    syncedPeer: undefined,
  };

  syncState = (data) => {
    const { syncedPeer } = this.state;
    if (syncedPeer && this.peersContext) {
      const syncData = {
        inputRouting: data.inputRouting,
        outputRouting: data.outputRouting,
        sidechainRouting: data.sidechainRouting,
        runtimes: data.runtimes.map((rt) => ({
          id: rt.id,
          name: rt.name,
          type: rt.type,
          registry: undefined,
        })),
        services: Object.keys(data.services).reduce(
          (all, runtimeId) => ({
            ...all,
            [runtimeId]: data.services[runtimeId].map((svc) => ({
              serviceId: svc.serviceId,
              serviceName: svc.serviceName,
              uuid: svc.uuid,
            })),
          }),
          {}
        ),
      };
      this.peersContext.sendData(this.getPeerName(), syncedPeer, syncData);
    }
  };

  onConnected = () => {
    this.syncState(this.props.boardContext);
  };

  onData = (updatedBoardState) => {
    const { boardContext, defaultBrowserRegistry, onUpdate } = this.props;
    const syncedStateUpdate = syncBoard(
      boardContext,
      updatedBoardState,
      defaultBrowserRegistry
    );
    if (syncedStateUpdate) {
      onUpdate(syncedStateUpdate);
    }
  };

  getPeerName = () =>
    `${SYNC_BOARD_PREFIX}-${this.props.boardContext.boardName}`;

  render() {
    const peerName = this.getPeerName();
    return (
      <PeersProvider ref={(context) => (this.peersContext = context)}>
        <Peer name={peerName} active={true} onData={this.onData}>
          <PeersConsumer>
            {(peers) => (
              <SelectorField
                label="Peer Sync"
                options={peers.peerNames
                  .filter(
                    (x) => x !== peerName && x.startsWith(SYNC_BOARD_PREFIX)
                  )
                  .reduce((all, cur) => ({ ...all, [cur]: cur }), {})}
                value={this.state.syncedPeer}
                disabled={false}
                onChange={(_, { value: selected }) =>
                  this.setState({ syncedPeer: selected }, this.onConnected)
                }
                onOpen={() => console.log("TODO: Activate Board Peer Sync")}
              />
            )}
          </PeersConsumer>
        </Peer>
      </PeersProvider>
    );
  }
}
