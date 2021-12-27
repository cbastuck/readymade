import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import Peer from "../../components/Peer";
import PeersProvider, { PeersConsumer } from "../../PeersContext";
import SelectorField from "../../components/shared/SelectorField";
import { mergeBoardState, extractSyncState } from "../../core/sync";

import { s, t } from "../../styles";

const SYNC_BOARD_PREFIX = "board-peer";

export default class PeerSync extends Component {
  state = {
    syncedPeer: undefined,
  };

  syncBoard = async () => {
    const { syncedPeer } = this.state;
    if (syncedPeer && this.peersContext) {
      const data = await this.props.boardContext.serializeBoard();
      const syncData = extractSyncState(data);
      this.peersContext.sendData(this.getPeerName(), syncedPeer, syncData);
    }
  };

  onConnected = () => {
    this.syncBoard();
  };

  onData = (updateMessage) => {
    const { boardContext, defaultBrowserRegistry, onUpdate } = this.props;
    const { data: updatedBoardState } = updateMessage;
    const syncedStateUpdate = mergeBoardState(
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

  /*
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
            t.fs11,
            t.ls1
          )}
          onClick={() => this.setState({ expanded: true })}
        >
          Enable Peer Sync
        </Button>
      </div>
    );
  };
*/

  renderExpanded = () => {
    const peerName = this.getPeerName();
    return (
      <div style={{ margin: "0px 3px", padding: 0 }}>
        <PeersProvider ref={(context) => (this.peersContext = context)}>
          <Peer
            name={peerName}
            active={!!this.props.active}
            onData={this.onData}
          >
            <PeersConsumer>
              {(peers) => (
                <div style={{ display: "flex", flexDirection: "row" }}>
                  <SelectorField
                    label="Peer Sync"
                    options={peers.peerNames
                      // TODO: Probably need some filtering since list could be too long
                      /*.filter(
                        (x) => x !== peerName && x.startsWith(SYNC_BOARD_PREFIX)
                      )*/
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
                    style={s(t.uc, t.fs11, t.ls1, { height: 33, width: 80 })}
                    onClick={() => this.syncBoard()}
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
    return this.renderExpanded();
  }
}
