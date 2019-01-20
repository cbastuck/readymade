import React, { Component, createContext } from 'react'

import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { createServiceUI } from '../UIFactory';

import {
  getServices,
  addService,
  saveBoard,
  getUserBoards,
  loadBoard,
  getRegistry
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
    this.fetchRegistry();
    this.fetchServices();
    this.fetchUserBoards();
  }

  getBoardName = () => {
    const { match } = this.props;
    return match.params.board;
  }

  addService = async serviceDesc => {
    await addService(this.getBoardName(), serviceDesc);
    await this.fetchServices();
  }

  fetchRegistry = async () => {
    const board = this.getBoardName();
    const registry = await getRegistry(board);
    this.setState({ registry });
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

  fetchUserBoards = async () => {
    const boards = await getUserBoards();
    this.setState({
      savedBoards: boards
    });
  }

  onAction = async action => {
    switch (action.type) {
      case 'clearBoard':
        await this.fetchServices();
        await this.fetchUserBoards();
        break;
      case 'saveBoard':
        await saveBoard(this.getBoardName());
        await this.fetchUserBoards();
        break;
      case 'loadBoard':
        loadBoard(action.board);
        break;
      default:
        console.log('Unknown action', action);
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
            board={this.getBoardName()}
            savedBoards={this.state.savedBoards}
            registry={this.state.registry}
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
