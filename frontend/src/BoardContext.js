
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
      await this.fetchRegistry(); // FIXME: always after fetchRuntimes
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

        this.restoreBrowserRuntimes(board, runtime, services);
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
        await this.fetchRegistry(); // FIXME: always after fetchRuntimes
        await this.fetchServices();
        await this.fetchUserBoards();
        this.browserRuntimes = [];
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
        const existing = JSON.parse(localStorage.getItem(`runtimes-${boardName}`) || '[]');
        localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(existing.concat(created.id)));
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

  restoreBrowserRuntimes = async (board, runtime, services) => {
    console.log('RESTORING BROWSER RUNTIME', runtime.name)
    // is the given runtime one handled by this browser?
    const localBoardRuntimes = JSON.parse(localStorage.getItem(`runtimes-${board}`) || '[]');
    if (localBoardRuntimes.find(lrt => lrt === runtime.id)) {
      const localBoardRuntimeId = runtime.id;
      const exists = this.browserRuntimes.find(brt => brt.id === localBoardRuntimeId);
      if (exists) {
        return; // we already created it 
      }
      console.log('CREATING BROWSER RUNTIME', runtime.name)
      const browserRuntime = new BrowserRuntime(runtime);
      this.browserRuntimes.push(browserRuntime);
      console.log('CONNECTING BROWSER RUNTIME', runtime.name, localBoardRuntimeId)
      browserRuntime.connect(localBoardRuntimeId);
      for (const service of services[runtime.name]) {
        browserRuntime.createService(
          {
            serviceId: service.serviceId, 
            board 
          }, 
          service.uuid
        );
      }
    }
  }

  getCurrentBrowserRuntime = runtimeId => {
    const board = this.getBoardName();

    const localRuntimes = JSON.parse(localStorage.getItem(`runtimes-${board}`) || '[]');
    if (localRuntimes.find(lrt => lrt === runtimeId)) {
      return this.browserRuntimes.find(rt => rt.id === runtimeId);
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
