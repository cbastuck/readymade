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
  state = { name: undefined };
  
  componentDidMount() {
    this.doImport();
  }

  async doImport() {
    const { location } = this.props;
    const values = queryString.parse(location.search);
    const { src, name } = values;
    if (src && name) {
      const response = await fetch(src);
      const data = await response.json();  
      for (const runtimeId in data) {
        const rt = data[runtimeId];
        if (rt.type === 'browser') {
          rt.params.registry = BrowserRuntime.registry();
          BoardContext.registerBrowserRuntime(name, runtimeId);
        }
        if (!rt.id) {
          rt.id = runtimeId;
        }
      }
      await clearBoard(name);
      await loadBoard(name, data);
      this.setState({ name });
    }
  }

  render() {
    if (!this.state.name) {
      return false;
    }
    return <Redirect to={`/${this.state.name}`} />;
  }
}