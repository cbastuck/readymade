import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import queryString from 'query-string';

import BoardContext from './BoardContext';
import BrowserRuntime from './runtime/BrowserRuntime';
import {
  loadBoard,
  clearBoard,
} from './core/actions';

export default class Import extends Component {
  state = { board: undefined };
  
  componentDidMount() {
    this.doImport();
  }

  async doImport() {
    const { location } = this.props;
    const values = queryString.parse(location.search);
    const { src, board } = values;
    if (src && board) {
      const response = await fetch(src);
      const data = await response.json();  
      for (const runtimeId in data) {
        const rt = data[runtimeId];
        if (rt.type === 'browser') {
          rt.params = rt.params || {};
          if (!rt.params.registry) {
            rt.params.registry = BrowserRuntime.registry();
          }
          BoardContext.registerBrowserRuntime(board, runtimeId);
        }
        if (!rt.id) {
          rt.id = runtimeId;
        }
      }
      await clearBoard(board);
      await loadBoard(board, data);
      this.setState({ board });
    }
  }

  render() {
    if (!this.state.board) {
      return false;
    }
    return <Redirect to={`/${this.state.board}`} />;
  }
}