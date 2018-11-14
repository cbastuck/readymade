import React, { Component } from 'react'

import { GraphProvider } from '../components/GraphProvider';
import Device from '../components/Device';

class Board extends Component {
  state = {
    devices: []
  };

  addDevice = device => {
    this.setState({
     devices: this.state.devices.concat(device)
    });
  }

  render() {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
        }}
      >
        <GraphProvider
          onAddDevice={this.addDevice}
          devices={this.state.devices}
        >
          <Device />
        </GraphProvider>
      </div>
    );
  }
}

export default Board
