import React, { Component, createContext } from 'react'

import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { createServiceUI } from '../UIFactory';

import {
  getServices,
  addService,
  saveBoard,
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

  getBoardName = () => {
    const { match } = this.props;
    return match.params.board;
  }

  addService = async serviceDesc => {
    await addService(this.getBoardName(), serviceDesc);
    await this.fetchServices();
  }

  fetchServices = async () => {
    const board = this.getBoardName();
    const { services } = await getServices(board);
    if(services) {
      this.setState({
          services: services.map(serviceId =>
            createServiceUI(board, serviceId))
      });
    }
  }

  onAction = async action => {
    switch (action.type) {
      case 'clearBoard':
        this.setState({services: []});
        break;
      case 'saveBoard':
        saveBoard(this.getBoardName());
        break;
      default:
        break;
    }
  }

  render() {
    const { match } = this.props;
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
            board={match.params.board}
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
