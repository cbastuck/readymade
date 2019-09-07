
import React, { Component, createContext } from'react';

import BrowserRuntime from './runtime/BrowserRuntime';

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
      getCurrentBrowserRuntime: this.getCurrentBrowserRuntime,

      // data
      boardName: props.boardName,
      runtimes: [],
      services: {},
      registry: undefined,
      savedBoards: []
    };

    this.browserRuntimes = [];
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
      await this.restoreBrowserRuntimes();

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
    this.setState({ runtimes: runtimes });
    return runtimes;
  }

  fetchRegistry = async () => {
    const board = this.getBoardName();
    const registry = {};
    for (const runtime of this.state.runtimes) {
      const runtimeRegistry = await getRuntimeRegistry(board, runtime.name);
      registry[runtime.name] = runtimeRegistry;
    } 
    this.setState({ registry });
  }

  fetchServices = async () => {
    const board = this.getBoardName();
    const services = {};
    if (board) {
      for (const runtime of this.state.runtimes) {
        const { services: runtimeServices } = await getServices(board, runtime.name);
        services[runtime.name] = runtimeServices;
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

  addRuntime = async (type, name) => {
    const boardName = this.getBoardName();
    if (boardName) {
      const runtimeName = `${name || type}-${this.state.runtimes.length}`;
      const params = {};
      if (type === 'browser') {
        params.registry = BrowserRuntime.registry();
      }
      const desc = { 
        type,
        name: runtimeName,
        params
      };
      const created = await addRuntime(boardName, desc);
      if (type === 'browser') {
        // remember if of created runtime, it belongs to 'this' browser
        localStorage.setItem(`runtimeId-${boardName}`, created.id);
      }
      await this.fetchData();
    }
  }

  addService = async descriptor => {
    const boardName = this.getBoardName();
    if (boardName) {
      await addService(boardName, descriptor);
      await this.fetchServices();
    }
  }

  restoreBrowserRuntimes = async () => {
    const board = this.getBoardName();
    // did we store a runtime we should restore
    const localBoardRuntimeId = localStorage.getItem(`runtimeId-${board}`);
    if (localBoardRuntimeId) {
      const runtime = this.state.runtimes.find(rt => rt.id === localBoardRuntimeId);
      if (runtime) {
        const browserRuntime = new BrowserRuntime(runtime.name);
        this.browserRuntimes.push(browserRuntime);
        browserRuntime.connect(localBoardRuntimeId);
        for (const service of this.state.services[runtime.name]) {
          browserRuntime.createService(
            { 
              serviceId: service.serviceId, 
              board 
            }, 
            service.uuid
          );
        }
      } else {
        localStorage.removeItem(`runtimeId-${board}`); // seems the remote rt does not exist anymore
      } 
    }
  }

  getCurrentBrowserRuntime = () => {
    const board = this.getBoardName();
    const localBoardRuntimeId = localStorage.getItem(`runtimeId-${board}`);
    return this.browserRuntimes.find(rt => rt.id === localBoardRuntimeId);
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
