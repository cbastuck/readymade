import React, { Component } from 'react';

import HeaderMenu from './HeaderMenu';

import {
  clearBoard,
} from '../core/actions';

export default class Toolbar extends Component {
  render() {
    const { 
      board, 
      savedBoards, 
      onAddService, 
      onAddRuntime,
      registry,
      onAction
    } = this.props;
    return (
      <div
        style={{
          marginBottom: 5,
          textAlign: 'left',
          borderBottom: '1px solid rgba(34,36,38,.15)',
        }}
      >
        <HeaderMenu
          board={board}
          registry={registry}
          addService={onAddService}
          addRuntime={onAddRuntime}
          savedBoards={savedBoards}
          onAction={async action => {
            if (onAction) {
              switch (action.type) {
                case 'clearBoard':
                  await clearBoard(board);
                  return onAction(action);
                default:
                  onAction(action)
              }
            }
          }}
        />
      </div>
    );
  }
}
