
import React, { Component, createContext } from'react';

import {
  getServices,
  addService,
  saveBoard,
  getUserBoards,
  loadBoard,
  getRegistry
} from './core/actions';

const { Provider, Consumer: BoardConsumer } = createContext();

class BoardContext extends Component {

  constructor(props) {
    super(props);

    this.state = {
      // API
      addService: this.addService,
      onAction: this.onAction,

      // data
      boardName: props.boardName,
      services: [],
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
      await this.fetchRegistry();
      await this.fetchServices();
      await this.fetchUserBoards();
    } catch(error) {
      console.log('Fetching data failed');
    }
  }
    
  getBoardName = () => {
    return this.state.boardName;
  }

  fetchRegistry = async () => {
    const board = this.getBoardName();
    const registry = await getRegistry(board || '');
    this.setState({ registry });
    return registry;
  }

  fetchServices = async () => {
    const board = this.getBoardName();
    if (board) {
      const { services } = await getServices(board);
      this.setState({ services });
      return services;
    }
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

  addService = async serviceDesc => {
    const boardName = this.getBoardName();
    if (boardName) {
      await addService(boardName, serviceDesc);
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
