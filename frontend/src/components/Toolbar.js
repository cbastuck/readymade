import React, { Component } from 'react';

import HeaderMenu from './HeaderMenu';

// import { clearBoard } from '../core/actions';

export default class Toolbar extends Component {
  render() {
    const { 
      board,
      availableRuntimes,
      onAction,
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
          availableRuntimes={availableRuntimes}
          onAction={onAction}
        />
      </div>
    );
  }
}
