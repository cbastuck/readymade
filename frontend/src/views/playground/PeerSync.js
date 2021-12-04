import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import Peer from "../../components/Peer";
import PeersProvider, { PeersConsumer } from "../../PeersContext";
import SelectorField from "../../components/shared/SelectorField";
import { syncBoard } from "../../core/sync";

import { s, t } from "../../styles";

const SYNC_BOARD_PREFIX = "board-peer";

export default class PeerSync extends Component {
  state = {
    expanded: false,
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

  onData = (updateMessage) => {
    const { boardContext, defaultBrowserRegistry, onUpdate } = this.props;
    const { data: updatedBoardState } = updateMessage;
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

  renderCollapsed = () => {
    return (
      <div style={{ margin: "0px 3px", padding: 0 }}>
        <Button
          style={s(
            {
              height: 25,
              width: "100%",
              backgroundColor: "white",
              border: "solid 1px lightgray",
              padding: 5,
            },
            t.uc,
            t.fs12,
            t.ls1
          )}
          onClick={() => this.setState({ expanded: true })}
        >
          Enable Peer Sync
        </Button>
      </div>
    );
  };

  renderExpanded = () => {
    const peerName = this.getPeerName();
    return (
      <div style={{ margin: "0px 3px", padding: 0 }}>
        <PeersProvider ref={(context) => (this.peersContext = context)}>
          <Peer name={peerName} active={true} onData={this.onData}>
            <PeersConsumer>
              {(peers) => (
                <div style={{ display: "flex", flexDirection: "row" }}>
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
                    onOpen={() =>
                      this.peersContext && this.peersContext.updatePeers()
                    }
                  />
                  <Button
                    style={s(t.uc, t.fs12, t.ls1, { height: 33, width: 80 })}
                    onClick={() => this.syncState(this.props.boardContext)}
                  >
                    push
                  </Button>
                </div>
              )}
            </PeersConsumer>
          </Peer>
        </PeersProvider>
      </div>
    );
  };

  render() {
    return this.state.expanded ? this.renderExpanded() : this.renderCollapsed();
  }
}
