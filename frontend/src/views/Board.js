import React, { Component, createContext } from 'react'

import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { createServiceUI } from '../UIFactory';

import {
  getServices,
  addService,
  setCurrentBoardName
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
    setCurrentBoardName(this.props.match.params.board);
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

  onAction = action => {
    switch (action.type) {
      case 'clearBoard':
        this.setState({services: []});
        break;
      default:
        break;
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
          value={this.state.boardContext}
        >
          <Toolbar
            onAddService={this.addService}
            onAction={this.onAction}
          />
          <Scene>
            { this.state.services }
          </Scene>
        </Provider>
      </div>
    );
  }
}

export default Board
export { BoardConsumer };
