import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import Peer from "../../components/Peer";
import PeersProvider, { PeersConsumer } from "../../PeersContext";
import SelectorField from "../../components/shared/SelectorField";
import { mergeBoardState, extractSyncState } from "../../core/sync";

import { s, t } from "../../styles";

const SYNC_BOARD_PREFIX = "board";

export default class PeerSync extends Component {
  componentDidUpdate(prevProps) {
    const { active, syncedPeer } = this.props;

    let doSync = false;
    if (prevProps.syncedPeer !== syncedPeer) {
      if (prevProps.syncedPeer && prevProps.active) {
        this.onClose();
      }

      if (syncedPeer) {
        doSync = true;
      }
    }

    if (prevProps.active !== active) {
      if (!!active) {
        doSync = true;
      } else if (prevProps.active === true) {
        this.onClose();
      }
    }

    if (doSync) {
      this.syncBoard();
    }
  }

  componentWillUnmount() {
    const { active, syncedPeer, onClose } = this.props;

    if (active && syncedPeer && onClose) {
      onClose();
    }
  }

  onClose = () => {
    const { onClose } = this.props;
    if (onClose) {
      onClose();
    }
  };

  syncBoard = async () => {
    const { syncedPeer, active } = this.props;
    if (active && syncedPeer && this.peersContext) {
      const data = await this.props.boardContext.serializeBoard();
      if (data !== null) {
        const syncData = extractSyncState(data);
        this.peersContext.sendData(this.getPeerName(), syncedPeer, syncData);
      }
    }
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

  renderExpanded = () => {
    const peerName = this.getPeerName();
    return (
      <div style={{ margin: "0px 3px", padding: 0 }}>
        <PeersProvider ref={(context) => (this.peersContext = context)}>
          <Peer
            name={peerName}
            active={!!this.props.active}
            onData={this.onData}
            onOpen={this.syncBoard}
          >
            <PeersConsumer>
              {(peers) => (
                <div style={{ display: "flex", flexDirection: "row" }}>
                  <SelectorField
                    label="Peer Sync"
                    options={peers.peerNames
                      // TODO: Probably need some filtering since list could be too long
                      .filter(
                        //(x) => x !== peerName && x.startsWith(SYNC_BOARD_PREFIX)
                        (x) => x !== peerName
                      )
                      .reduce((all, cur) => ({ ...all, [cur]: cur }), {})}
                    value={this.props.syncedPeer}
                    disabled={false}
                    onChange={(_, { value: syncedPeer }) =>
                      this.props.onSyncedPeerChanged(syncedPeer)
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
