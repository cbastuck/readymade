import React, { Component } from 'react';

import HeaderMenu from './HeaderMenu';

import QR from './QR';
import {
  clearBoard,
} from '../core/actions';

export default class Toolbar extends Component {
  state = {
    qrCodeVisible: false
  };

  render() {
    const { board, savedBoards, onAddService, onAddRuntime} = this.props;
    return (
      <div
        style={{
          width: '100%',
          marginBottom: 5,
          textAlign: 'left',
          //position: 'fixed',
          //zIndex: 10000,
        }}
      >
        <HeaderMenu
          board={board}
          registry={this.props.registry}
          addService={onAddService}
          addRuntime={onAddRuntime}
          savedBoards={savedBoards}
          onAction={async action => {
            const { onAction } = this.props;
            if (onAction) {
              switch (action.type) {
                case 'showQRCode':
                  return this.setState({ qrCodeVisible: true });
                case 'clearBoard':
                  await clearBoard(board);
                  return onAction(action);
                default:
                  onAction(action)
              }
            }
          }}
        />
        {
          this.state.qrCodeVisible && (
            <QR
              onClick={() => this.setState({ qrCodeVisible: false })}
            />
          )
        }
      </div>
    );
  }
}
