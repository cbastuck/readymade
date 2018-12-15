import React, { Component, createContext } from 'react'

import Authorization from '../components/Authorization';
import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { createServiceUI } from '../UIFactory';

import {
  getServices,
  addService,
  redirectToLogin
} from '../core/actions';

const { Provider, Consumer: BoardConsumer } = createContext();

class Board extends Component {
  state = {
    services: [],
    // context the board provides
    boardContext: {
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
      <Authorization>
        <div
          style={{
            height: '100%',
            width: '100%',
            padding: 5
          }}
        >
        <Provider
            value={this.state.boardContext}
          >
            <Toolbar
              onAddService={this.addService}
              enterAddConnectionMode={() =>
                this.setState({
                  app: {
                    ...this.state.boardContext,
                    mode: 'connection'
                  }
                })
              }
              onRefresh={this.fetchServices}
              onAccount={redirectToLogin}
            />
            <Scene>
              { this.state.services }
            </Scene>
          </Provider>
        </div>
      </Authorization>
    );
  }
}

export default Board
export { BoardConsumer };
