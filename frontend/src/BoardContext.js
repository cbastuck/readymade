
import React, { Component, createContext } from'react';
import UAParser from 'ua-parser-js';

// TODO: this should also go to Runtime like the RemoteRuntime
import BrowserRuntime from './runtime/BrowserRuntime';
import BrowserRegistry from './runtime/BrowserRegistry';
import ResizeObserver from './ResizeObserver';

import {
  getServices,
  addService,
  removeService,
  saveBoard,
  loadBoard,
  getBoard,
  getRuntimes,
  getRuntimeRegistry,
  addRuntime,
  configureService,
  clearBoard,
} from './core/actions';

const { Provider, Consumer: BoardConsumer } = createContext();

class BoardContext extends Component {
  static registerBrowserRuntime(boardName, runtimeId) {
    // remember id of created runtime, it belongs to 'this' browser
    const existing = JSON.parse(localStorage.getItem(`runtimes-${boardName}`) || '[]');
    localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(existing.concat(runtimeId)));
  }

  static unregisterBrowserRuntime(boardName, runtimeId) {
    // unremember that the id belongs to 'this' browser
    const existing = JSON.parse(localStorage.getItem(`runtimes-${boardName}`) || '[]');
    const pruned = existing.filter(id => id !== runtimeId);
    localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(pruned));
  }

  constructor(props) {
    super(props);

    this.state = {
      // API
      fetchData: this.fetchData,
      addRuntime: this.addRuntime,
      addService: this.addService,
      arrangeService: props.arrangeService || this.arrangeService,
      removeService: this.removeService,
      removeAllServices: this.removeAllServices,
      onAction: props.onAction || this.onAction,
      getCurrentBrowserRuntime: props.getCurrentBrowserRuntime || this.getCurrentBrowserRuntime,
      isRuntimeInScope: props.isRuntimeInScope || this.isRuntimeInScope,
      acquireRuntimeScope: this.acquireRuntimeScope,
      releaseRuntimeScope: this.releaseRuntimeScope,

      // data
      viewportWidth: undefined,
      appViewMode: 'wide',

      user: props.user,
      board: {},
      boardName: props.boardName, // TODO: this is also part of board
      runtimes: [],
      services: {},
      registry: {},
      savedBoards: [],
    };

    // TODO: this must be removed!! lifetime is handled by react
    this.browserRuntimes = [];
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const { user, fetchData } = this.props;
    if (prevProps.fetchData !== fetchData && !!fetchData) {
      this.setState({ fetchData }, this.fetchData);
    } else if (prevProps.user !== user) {
      this.setState({ user });
    }
  }

  fetchData = async () => {
    const { fetchData=this.fetchDataDefault } = this.props;
    if (fetchData === false) {
      return;
    }
    const {
      board,
      services, 
      savedBoards,
      registry,
      runtimes=[],
    } = await fetchData();
    
    for (const runtime of runtimes) {
      if (runtime.type === 'browser') {
        const createdServices = await this.restoreBrowserRuntimes(board, runtime, services);
        if (createdServices) {
          services[runtime.id] = createdServices;
        }
      } else if (runtime.type === 'node') {
        // wrap the runtime services 
        // TODO: Probably this should not happen here!
        for (const svc of services) {
          svc.configure = async config => {
            const resp = await configureService(board, svc, config);
            return resp.json();
          }
        }
        services[runtime.id] = services;
      } else {
        console.error('Unknown runtime type', runtime);
      }

      if (registry) {
        runtime.registry = registry[runtime.id];
      }
    }

    this.setState({
      board,
      boardName: board && board.name,
      runtimes,
      registry,
      services,
      savedBoards,
    });
  }

  fetchDataDefault = async () => {
    try {
      const board = await this.fetchBoard();
      const runtimes = await this.fetchRuntimes();
      const registry = await this.fetchRegistry(runtimes); // FIXME: always after fetchRuntimes
      const services = await this.fetchServices(runtimes);
      const userBoards = await this.fetchUserBoards();
      return { board, runtimes, registry, services, userBoards };
    } catch(error) {
      console.log('Fetching data failed', error);
    }
  }
    
  getBoardName = () => {
    return this.state.boardName;
  }

  fetchBoard = async () => {
    const boardname = this.getBoardName();
    if (boardname) {
      const board = await getBoard(boardname);      
      return board;
    }
  }

  fetchRuntimes = async () => {
    const board = this.getBoardName();
    const runtimes = board ? await getRuntimes(board) : [];
    return runtimes;
  }

  fetchRegistry = async runtimes => {
    if (!runtimes) {
      runtimes = this.state.runtimes;
    }
    const board = this.getBoardName();
    const registry = {};
    if (runtimes) {
      for (const runtime of runtimes) {
        const runtimeRegistry = await getRuntimeRegistry(board, runtime.id);
        registry[runtime.id] = runtimeRegistry;
      }
    }
    return registry;
  }

  fetchServices = async runtimes => {
    if (!runtimes) {
      runtimes = this.state.runtimes;
    }
    const board = this.getBoardName();
    const services = {};
    if (board && runtimes) {
      for (const runtime of runtimes) {
        const { services: runtimeServices } = await getServices(board, runtime.id);
        services[runtime.id] = runtimeServices;
      }
    }
    return services;
  }

  fetchUserBoards = async () => {
    const boards = Object.keys(localStorage)
            .filter(key => key.startsWith('board-'))
            .map(key => key.substr(6));
    return boards;
  }

  onAction = async action => {
    const boardname = this.getBoardName();
    switch (action.type) {
      case 'clearBoard':
        await clearBoard(boardname);
        for (const runtime of this.browserRuntimes) {
          runtime.destroyRuntime();
        }
        this.browserRuntimes = [];
        await this.fetchData();
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

  arrangeService(runtime, serviceUuid, position) {
    console.log('TODO: BoardContext.arrangeService')
  }

  addRuntime = async (type, name) => {
    const { user } = this.state;
    const { addRuntime=this.addRuntimeDefault } = this.props;
    const boardName = this.getBoardName();
    if (!boardName) {
      console.error('Board name missing for adding a runtime');
      return;
    }

    const params = {};
    if (type === 'browser') {
      params.registry = await BrowserRegistry.create([], user).availableServices;
      const browser = new UAParser().getBrowser();
      if (browser) {
        name = browser.name;
      }
    }
    const desc = { 
      type,
      name,
      params,
    };
    await addRuntime(boardName, desc);
    await this.fetchData();
  
  }

  addRuntimeDefault = async (boardName, desc) => {
    const created = await addRuntime(boardName, desc);
    if (desc.type === 'browser') {
      BoardContext.registerBrowserRuntime(boardName, created.id);
    }
    return created;
  }

  addService = async (descriptor, runtimeId) => {
    const { addService=this.addServiceDefault } = this.props;
    const boardName = this.getBoardName();
    if (boardName) {
      await addService(boardName, descriptor, runtimeId);
      await this.fetchData(); // TODO: fetching too much data
    }
  }

  addServiceDefault = (boardName, descriptor, runtimeId) => {
    return addService(boardName, descriptor, runtimeId);
  }

  removeService = async (runtime, service) => {
    const boardName = this.getBoardName();
    if (boardName) {
      await removeService(boardName, runtime.id, service.uuid);
      await this.fetchServices();
    }
  }

  removeAllServices = async runtime => {
    const { services } = this.state;
    const boardName = this.getBoardName();
    if (boardName) {
      for (const service of services[runtime.id]) {
        await removeService(boardName, runtime.id, service.uuid);
      }
    }
    await this.fetchData();
  }

  restoreBrowserRuntimes = async (board, runtime, services) => {
    // is the given runtime one handled by this browser?
    const localBoardRuntimes = JSON.parse(localStorage.getItem(`runtimes-${board}`) || '[]');
    if (localBoardRuntimes.find(lrt => lrt === runtime.id)) {
      const localBoardRuntimeId = runtime.id;
      const exists = this.browserRuntimes.find(brt => brt.id === localBoardRuntimeId);
      if (exists) {
        return exists.services; // we already created it 
      }
      const createdBrowserServices = [];
      const params = { 
        ...runtime.params, 
        board: this.state.boardName, 
        user: this.state.user 
      };
      const browserRuntime = await BrowserRuntime.createInstance(
        runtime,
        params,
      ); 
      this.browserRuntimes.push(browserRuntime);
      browserRuntime.connect(localBoardRuntimeId);
      for (const service of services) {
        const browserService = browserRuntime.createService(
          {
            serviceId: service.serviceId, 
            board 
          }, 
          service.uuid,
          service.initialConfig,
        );
        if (browserService) {
          browserService.serviceId = service.serviceId;
          browserService.serviceName = service.serviceName;
          createdBrowserServices.push(browserService);
        }
      }
      return createdBrowserServices;
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
      return !!this.browserRuntimes.find(rt => rt.id === runtime.id);
    } 
    return true;
  }

  acquireRuntimeScope = (boardname, runtime) => {
    if (runtime.type === 'browser') {
      if (!this.isRuntimeInScope(runtime)) {
        BoardContext.registerBrowserRuntime(boardname, runtime.id);
        this.fetchData();
      }
    }
  }

  releaseRuntimeScope = (boardname, runtime) => {
    if (runtime.type === 'browser') {
      BoardContext.unregisterBrowserRuntime(boardname, runtime.id);
      let releasedRT;
      this.browserRuntimes = this.browserRuntimes.filter(rt => {
        if (rt.id === runtime.id) {
          releasedRT = rt;
          return false;
        }
        return true;
      });
      if (releasedRT) {
        releasedRT.destroyRuntime();
      }
      this.fetchData();
    }
  }

  render() {
    const { children } = this.props;
    return (
      <Provider value={this.state}>
        { children }
        <ResizeObserver 
          onChange={data => this.setState({ ...data })} 
        />
      </Provider>
    );
  }
}

export { BoardConsumer };
export default BoardContext;
