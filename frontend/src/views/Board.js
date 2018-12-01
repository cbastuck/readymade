import React, { Component, createContext } from 'react'

import { GraphProvider } from '../components/GraphProvider';
import Toolbar from '../components/Toolbar';
import { createServiceUI } from '../UIFactory';

import { getServices, addService } from '../core/actions';

const { Provider, Consumer: BoardConsumer } = createContext();

class Board extends Component {
  state = {
    services: [],
    app: {
      mode: 'dashboard', // modes are dashboard, connection
    }
  };

  componentDidMount() {
    this.fetchServices();
  }

  addService = async serviceDesc => {
    await addService(serviceDesc);
    await this.fetchServices();
  }

  fetchServices = async () => {
    const { services } = await getServices();
    if(services) {
      this.setState({
          services: services.map(serviceId =>
            createServiceUI(serviceId))
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
            onAddService={this.addService}
            enterAddConnectionMode={() =>
              this.setState({
                app: {
                  ...this.state.app,
                  mode: 'connection'
                }
              })
            }
            onRefresh={this.fetchServices}
          />
          <GraphProvider>
            { this.state.services }
          </GraphProvider>
        </Provider>
      </div>
    );
  }
}

export default Board
export { BoardConsumer };
