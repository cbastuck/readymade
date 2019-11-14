
import React, { Component, createContext } from'react';
import UAParser from 'ua-parser-js';

import BrowserRuntime from './runtime/BrowserRuntime';

import {
  getServices,
  addService,
  saveBoard,
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
      isRuntimeInScope: this.isRuntimeInScope,

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
      await this.fetchUserBoards();
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
      const runtimeRegistry = await getRuntimeRegistry(board, runtime.id);
      registry[runtime.name] = runtimeRegistry;
    } 
    this.setState({ registry });
  }

  fetchServices = async () => {
    const board = this.getBoardName();
    const services = {};
    if (board) {
      for (const runtime of this.state.runtimes) {
        const { services: runtimeServices } = await getServices(board, runtime.id);
        services[runtime.name] = runtimeServices;

        this.restoreBrowserRuntimes(board, runtime, services);
      }
    }

    this.setState({ services });
    return services;
  }

  fetchUserBoards = async () => {
    const boards = Object.keys(localStorage)
            .filter(key => key.startsWith('board-'))
            .map(key => key.substr(6));

    this.setState({
      savedBoards: boards
    });
    return boards;
  }

  onAction = async action => {
    const boardname = this.getBoardName();
    switch (action.type) {
      case 'clearBoard':
        for (const runtime of this.browserRuntimes) {
          runtime.destroyRuntime();
        }
        this.browserRuntimes = [];
        await this.fetchRuntimes();
        await this.fetchRegistry(); // FIXME: always after fetchRuntimes
        await this.fetchServices();
        await this.fetchUserBoards();
        break;
      case 'saveBoard':
        const saveState = await saveBoard(boardname);
        localStorage.setItem(`board-${boardname}`, JSON.stringify(saveState));
        await this.fetchUserBoards();
        break;
      case 'loadBoard':
        try {
          const loadState = JSON.parse(localStorage.getItem(`board-${boardname}`));
          await loadBoard(action.board, loadState);
          await this.fetchData();
        } catch(error) {
          console.error('Loading board failed with error', error);
        }
        break;
      default:
        console.log('Unknown action', action);
        break;
    }
  }

  addRuntime = async (type, name) => {
    const boardName = this.getBoardName();
    if (boardName) {
      const params = {};
      if (type === 'browser') {
        params.registry = BrowserRuntime.registry();
        const browser = new UAParser().getBrowser();
        if (browser) {
          name = `${browser.name}-${browser.version}`;
        }
      }
      const desc = { 
        type,
        name,
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
    // is the given runtime one handled by this browser?
    const localBoardRuntimes = JSON.parse(localStorage.getItem(`runtimes-${board}`) || '[]');
    if (localBoardRuntimes.find(lrt => lrt === runtime.id)) {
      const localBoardRuntimeId = runtime.id;
      const exists = this.browserRuntimes.find(brt => brt.id === localBoardRuntimeId);
      if (exists) {
        return; // we already created it 
      }
      const browserRuntime = new BrowserRuntime(runtime);
      this.browserRuntimes.push(browserRuntime);
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

  isRuntimeInScope = runtime => {
    if (runtime.type === 'browser') {
      return this.browserRuntimes.find(rt => rt.id === runtime.id);
    } 
    return true;
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
