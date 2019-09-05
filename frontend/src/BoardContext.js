
import React, { Component, createContext } from'react';

import {
  getServices,
  addService,
  saveBoard,
  getUserBoards,
  loadBoard,
  getRuntimes,
  getRuntimeRegistry,
  addRuntime
} from './core/actions';

const { Provider, Consumer: BoardConsumer } = createContext();

class BoardContext extends Component {

  constructor(props) {
    super(props);

    this.state = {
      // API
      addRuntime: this.addRuntime,
      addService: this.addService,
      onAction: this.onAction,

      // data
      boardName: props.boardName,
      runtimes: [],
      services: {},
      registry: undefined,
      savedBoards: []
    };
  }

  componentDidMount() {
    if(this.props.fetchData) {
      this.fetchData();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.fetchData !== this.props.fetchData && this.props.fetchData) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    try {
      await this.fetchRuntimes();
      await this.fetchRegistry();
      await this.fetchServices();

      //await this.fetchUserBoards();
    } catch(error) {
      console.log('Fetching data failed');
    }
  }
    
  getBoardName = () => {
    return this.state.boardName;
  }

  fetchRuntimes = async () => {
    const board = this.getBoardName();
    const runtimes = board ? await getRuntimes(board) : [];
    this.setState({ runtimes });
    return runtimes;
  }

  fetchRegistry = async () => {
    const board = this.getBoardName();
    const registry = {};
    for (const runtime of this.state.runtimes) {
      const runtimeRegistry = await getRuntimeRegistry(board, runtime);
      registry[runtime] = runtimeRegistry;
    } 
    this.setState({ registry });
  }

  fetchServices = async () => {
    const board = this.getBoardName();
    const services = {};
    if (board) {
      for (const runtime of this.state.runtimes) {
        const { services: runtimeServices } = await getServices(board, runtime);
        services[runtime] = runtimeServices;
      }
    }
    this.setState({ services });
    return services;
  }

  fetchUserBoards = async () => {
    const boards = await getUserBoards();
    this.setState({
      savedBoards: boards
    });
    return boards;
  }

  onAction = async action => {
    switch (action.type) {
      case 'clearBoard':
        await this.fetchRuntimes();
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

  addRuntime = async type => {
    const boardName = this.getBoardName();
    if (boardName) {
      const desc = { 
        type, 
        name: `${type}-${this.state.runtimes.length}`
      };
      await addRuntime(boardName, desc);
      await this.fetchRuntimes();
      await this.fetchRegistry();
    }
  }

  addService = async descriptor => {
    const boardName = this.getBoardName();
    if (boardName) {
      await addService(boardName, descriptor);
      await this.fetchServices();
    }
  }

  render() {
    return (
      <Provider
        value={this.state}
      >
        { this.props.children }
      </Provider>
    );
  }
}

BoardContext.defaultProps = {
  fetchData: true
}

export { BoardConsumer };
export default BoardContext;
