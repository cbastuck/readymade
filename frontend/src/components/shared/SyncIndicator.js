import React, { Component } from 'react';

export default class SyncIndicator extends Component {
  render() {
    const { inSync, onClick } = this.props;
    return (
      <div 
        style={{ 
          width: 18,
          height: 18,
          margin: '8px 10px',
          backgroundColor: inSync ? 'green' : 'yellow',
          cursor: !inSync ? 'pointer' : undefined,
        }}
        onClick={ev => !inSync && onClick(ev)}
      />
    );
  }
}
