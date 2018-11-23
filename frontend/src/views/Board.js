import React, { Component, createContext } from 'react'

import { GraphProvider } from '../components/GraphProvider';
import Toolbar from '../components/Toolbar';
import { createDevice } from '../DeviceFactory';

import { getDevices, addDevice } from '../core/actions';

const { Provider, Consumer: BoardConsumer } = createContext();

class Board extends Component {
  state = {
    devices: [],
    app: {
      mode: 'dashboard', // modes are dashboard, connection
    }
  };

  componentDidMount() {
    this.fetchDevices();
  }

  addDevice = async deviceId => {
    await addDevice({ deviceId });
    await this.fetchDevices();
  }

  fetchDevices = async () => {
    const { devices } = await getDevices();

    console.log('Current devices', devices);
    if(devices) {
      this.setState({
          devices: devices.map(deviceId => createDevice(deviceId))
      });
    }
  }

  render() {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          padding: 5
        }}
      >
       <Provider
          value={this.state.app}
        >
          <Toolbar
            onAddDevice={this.addDevice}
            enterAddConnectionMode={() =>
              this.setState({
                app: {
                  ...this.state.app,
                  mode: 'connection'
                }
              })
            }
            onRefresh={this.fetchDevices}
          />
          <GraphProvider>
            { this.state.devices }
          </GraphProvider>
        </Provider>
      </div>
    );
  }
}

export default Board
export { BoardConsumer };
