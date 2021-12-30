import React, { Component } from "react";
import { Button, Dropdown } from "semantic-ui-react";

import Peer from "../../components/Peer";
import PeersProvider, { PeersConsumer } from "../../PeersContext";
import { ErrorNotification } from "../../components/Notifications";
import BoardSyncManagement from "./BoardSyncManagement";
import SelectorField from "../../components/shared/SelectorField";
import { mergeBoardState, extractSyncState } from "../../core/sync";

import { s, t } from "../../styles";

const SYNC_BOARD_PREFIX = "board";

export default class BoardSync extends Component {
  state = {
    acceptedSenders: [],
    rejectedSenders: [],
    pendingConfirmation: undefined,
    errorNotification: undefined,
    subPanel: false,
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
      if (this.state.acceptedSenders.indexOf(sender) === -1) {
        if (this.state.rejectedSenders.indexOf(sender) !== -1) {
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

  onError = (err) => {
    this.setState({ errorNotification: err.message });
  };

  getPeerName = () =>
    `${SYNC_BOARD_PREFIX}-${this.props.boardContext.boardName}`;

  renderConfirmation = () => {
    const style = s(t.uc, t.ls1, t.fs12);
    const { sender, onAccept } = this.state.pendingConfirmation;
    return (
      <>
        <div
          style={{
            ...style,
            padding: "5px 10px",
            marginRight: 5,
            textAlign: "left",
            width: "100%",
            border: "solid 1px lightgray",
            borderRadius: 2,
          }}
        >
          Sync request from: {sender}
        </div>
        <div style={{ marginLeft: "auto", width: "100%" }}>
          <Button
            style={style}
            onClick={() =>
              this.setState(
                {
                  pendingConfirmation: undefined,
                  acceptedSenders: [...this.state.acceptedSenders, sender],
                },
                onAccept
              )
            }
          >
            Accept
          </Button>
          <Button
            style={style}
            onClick={() =>
              this.setState({
                pendingConfirmation: undefined,
                rejectedSenders: [...this.state.rejectedSenders, sender],
              })
            }
          >
            Reject
          </Button>
        </div>
      </>
    );
  };

  renderSyncMenu = () => {
    const menuItemStyle = {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 1,
    };
    const mainEntry = "Board Sync";
    const onAccept = (sender) => {
      const senders = Array.isArray(sender) ? sender : [sender];
      this.setState({
        rejectedSenders: this.state.rejectedSenders.filter(
          (x) => senders.indexOf(x) === -1
        ),
        acceptedSenders: [...this.state.acceptedSenders, ...senders],
      });
    };
    const onReject = (sender) => {
      const senders = Array.isArray(sender) ? sender : [sender];
      this.setState({
        acceptedSenders: this.state.acceptedSenders.filter(
          (x) => senders.indexOf(x) === -1
        ),
        rejectedSenders: [...this.state.rejectedSenders, ...senders],
      });
    };
    return (
      <Dropdown
        text={this.state.subPanel ? this.state.subPanel.name : mainEntry}
        style={{
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
          backgroundColor: "#E8E8E8",
          borderRadius: 5,
          padding: "6px 10px",
          color: "#5c5d5c",
          border: "solid 1ox gray",
          whiteSpace: "nowrap",
        }}
      >
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => this.setState({ subPanel: undefined })}>
            <span style={menuItemStyle}>{mainEntry}</span>
          </Dropdown.Item>

          <Dropdown.Item
            onClick={() =>
              this.setState({
                subPanel: {
                  element: (
                    <BoardSyncManagement
                      onAccept={onAccept}
                      onReject={onReject}
                    />
                  ),
                  name: "Manage Sync",
                },
              })
            }
          >
            <span style={menuItemStyle}>Manage Sync</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  renderSyncBar = (peers, peerName) => (
    <>
      <SelectorField
        label={this.renderSyncMenu()}
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

  renderNotifications = () => {
    if (!this.state.errorNotification) {
      return false;
    }

    return (
      <ErrorNotification
        message={this.state.errorNotification}
        onClose={() => this.setState({ errorNotification: undefined })}
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
                  {this.state.pendingConfirmation
                    ? this.renderConfirmation()
                    : this.renderSyncBar(peers, peerName)}
                </div>
              )}
            </PeersConsumer>
          </Peer>
        </PeersProvider>
        {this.renderNotifications()}
        {this.state.subPanel &&
          React.cloneElement(this.state.subPanel.element, this.state)}
      </div>
    );
  }
}
