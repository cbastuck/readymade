import React, { Component } from 'react';
import {
  Input,
  Button,
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/fetcher';
const serviceName = 'Fetcher';

class FetcherUI extends Component {
  state = {};

  onInit(initialState) {
    this.setState({
      ...initialState
    });
  }

  renderMain = service => {
    return <div />;
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
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
  }

  configure(config) {
  }

  async process(params) {
    const res = await fetch(params.url);
    const blob = await res.blob();
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