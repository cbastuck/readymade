import React, { Component } from 'react';

import ServiceDropdown from './ServiceDropdown';

import QR from './QR';
import {
  clearBoard
} from '../core/actions';

export default class Toolbar extends Component {
  state = {
    qrCodeVisible: false
  };

  render() {
    const { board, savedBoards, onAddService} = this.props;
    return (
      <div
        style={{
          width: '100%',
          marginBottom: 5,
          textAlign: 'left'
        }}
      >

        <ServiceDropdown // TODO: the name is wrong, also contains the menu
          registry={this.props.registry}
          addService={onAddService}
          savedBoards={savedBoards}
          onAction={async action => {
            const { onAction } = this.props;
            switch (action.type) {
              case 'showQRCode':
                return this.setState({ qrCodeVisible: true });
              case 'clearBoard':
                await clearBoard(board);
                return onAction(action);
              default:
                onAction(action)
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
