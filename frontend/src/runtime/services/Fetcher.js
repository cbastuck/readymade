import React, { Component } from 'react';
import {
  Input,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/fetcher';
const serviceName = 'Fetcher';

class FetcherUI extends Component {
  state = { url: '' };

  onInit(initialState) {
    this.setState({
      ...initialState
    });
  }

  renderMain = service => {
    return (
      <Input
        disabled
        label="Fetching"
        value={this.state.url}
      />
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onTimer={service => 
          service.fetchingURL !== this.state.url && 
          this.setState({ url: service.fetchingURL || '' })
        }
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    );
  }
}

class Fetcher {
   constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.fetchingURL = undefined;
  }

  configure(config) {
  }

  getURL(params) {
    switch (typeof params) {
      case 'string':
        return params;
      case 'object':
        return params.url;
      default: 
        break;
    }
  } 

  async process(params) {
    const url = params && this.getURL(params);
    if (!url) {
      return;
    }

    this.fetchingURL = url;
    const res = await fetch(url);
    const blob = await res.blob();
    this.fetchingURL = undefined;
    return blob;  
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Fetcher(app, board, descriptor, id),
  createUI: FetcherUI
};

export default descriptor;