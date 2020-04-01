import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import queryString from 'query-string';

import {
  importBoard,
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
    if (src) {
      const response = await fetch(src);
      const data = await response.json();  
      await importBoard(name, data);
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