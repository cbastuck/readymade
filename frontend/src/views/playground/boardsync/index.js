import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import Peer from "../../../components/Peer";
import PeersProvider, { PeersConsumer } from "../../../PeersContext";
import { ErrorNotification } from "../../../components/Notifications";
import SelectorField from "../../../components/shared/SelectorField";
import { mergeBoardState, extractSyncState } from "../../../core/sync";
import ConfirmationRequest from "./ConfirmationRequest";
import Menu from "./Menu";
import { s, t } from "../../../styles";

const SYNC_BOARD_PREFIX = "board";

export default class BoardSync extends Component {
  state = {
    pendingConfirmation: undefined,
    errorNotification: undefined,
    subPanel: undefined,
  };

  componentDidUpdate(prevProps) {
    const { active, syncedPeer } = this.props;

    let doSync = false;
    if (prevProps.active !== active) {
      if (!!active) {
        doSync = true;
      } else if (prevProps.active === true) {
        this.onClose(prevProps.syncedPeer);
      }
    }

    if (prevProps.syncedPeer !== syncedPeer) {
      if (prevProps.syncedPeer && prevProps.active) {
        this.onClose(prevProps.syncedPeer);
      }

      if (syncedPeer) {
        doSync = true;
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
    if (this.props.onClose) {
      this.props.onClose();
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
    const { data: updatedBoardState, sender } = updateMessage;
    const syncedStateUpdate = mergeBoardState(
      boardContext,
      updatedBoardState,
      defaultBrowserRegistry
    );
    if (syncedStateUpdate) {
      if (this.props.acceptedSenders.indexOf(sender) === -1) {
        if (this.props.rejectedSenders.indexOf(sender) !== -1) {
          return;
        }
        if (!this.state.pendingConfirmation) {
          this.setState({
            pendingConfirmation: {
              sender,
              onAccept: () => onUpdate(syncedStateUpdate),
            },
          });
        }
      } else {
        onUpdate(syncedStateUpdate);
      }
    }
  };

  onError = (err) => this.setState({ errorNotification: err.message });

  getPeerName = () =>
    `${SYNC_BOARD_PREFIX}-${this.props.boardContext.boardName}`;

  onAcceptSenders = (senderOrSenders) => {
    const senders = Array.isArray(senderOrSenders)
      ? senderOrSenders
      : [senderOrSenders];
    this.props.onChange({
      rejectedSenders: this.props.rejectedSenders.filter(
        (x) => senders.indexOf(x) === -1
      ),
      acceptedSenders: [...this.props.acceptedSenders, ...senders],
    });
  };

  onRejectSenders = (senderOrSenders) => {
    const senders = Array.isArray(senderOrSenders)
      ? senderOrSenders
      : [senderOrSenders];
    this.props.onChange({
      acceptedSenders: this.props.acceptedSenders.filter(
        (x) => senders.indexOf(x) === -1
      ),
      rejectedSenders: [...this.props.rejectedSenders, ...senders],
    });
  };

  renderSyncBar = (peers, peerName) => {
    return (
      <>
        <SelectorField
          label={
            <Menu
              actions={{
                onAccept: this.onAcceptSenders,
                onReject: this.onRejectSenders,
              }}
              value={this.state.subPanel}
              onChange={(subPanel) => this.setState({ subPanel })}
            />
          }
          options={peers.peerNames
            .filter((x) => x !== peerName)
            .reduce((all, cur) => ({ ...all, [cur]: cur }), {})}
          value={this.props.syncedPeer}
          disabled={false}
          onChange={(_, { value: syncedPeer }) =>
            this.props.onSyncedPeerChanged(syncedPeer)
          }
          onOpen={() => this.peersContext && this.peersContext.updatePeers()}
          placeholder="Select a sync target"
        />
        <Button
          style={s(t.uc, t.fs11, t.ls1, {
            height: 33,
            width: 80,
            color: "#5c5d5c",
          })}
          onClick={this.syncBoard}
        >
          push
        </Button>
      </>
    );
  };

  renderConfirmationRequest = (pendingConfirmation) => {
    if (!pendingConfirmation) {
      return false;
    }
    const { sender, onAccept } = pendingConfirmation;
    return (
      <ConfirmationRequest
        sender={sender}
        onAccept={() => {
          this.setState(
            {
              pendingConfirmation: undefined,
            },
            () => {
              this.props.onChange({
                acceptedSenders: [...this.props.acceptedSenders, sender],
              });
              onAccept();
            }
          );
        }}
        onReject={() => {
          this.setState(
            {
              pendingConfirmation: undefined,
            },
            () =>
              this.props.onChange({
                rejectedSenders: [...this.props.rejectedSenders, sender],
              })
          );
        }}
      />
    );
  };

  render() {
    const peerName = this.getPeerName();
    return (
      <div
        style={{
          margin: "0px 3px",
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PeersProvider ref={(context) => (this.peersContext = context)}>
          <Peer
            name={peerName}
            active={!!this.props.active}
            onData={this.onData}
            onOpen={this.syncBoard}
            onError={this.onError}
            onConnectionOpened={(syncedPeer) =>
              this.props.onSyncedPeerChanged(syncedPeer)
            }
            onConnectionClosed={(dst) =>
              this.props.onSyncedPeerChanged(undefined)
            }
          >
            <PeersConsumer>
              {(peers) => (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    marginLeft: 2,
                  }}
                >
                  {this.renderConfirmationRequest(
                    this.state.pendingConfirmation
                  ) || this.renderSyncBar(peers, peerName)}
                </div>
              )}
            </PeersConsumer>
          </Peer>
        </PeersProvider>
        <ErrorNotification
          message={this.state.errorNotification}
          onClose={() => this.setState({ errorNotification: undefined })}
        />
        {this.state.subPanel &&
          React.cloneElement(this.state.subPanel.element, {
            acceptedSenders: this.props.acceptedSenders,
            rejectedSenders: this.props.rejectedSenders,
          })}
      </div>
    );
  }
}
