import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/buffer';
const serviceName = 'Buffer';

class BufferUI extends Component {
  state = { capacity: 0 };

  onInit(initialState) {
    const { capacity } = initialState;
    this.setState({
      capacity,
    });
  }

  renderMain = service => {
    return (
      <div>
        <Input
            type="number"
            value={this.state.capacity}
            onChange={(_, { value }) => {
              const capacity = value !== '' && Number(value);
              service.configure({ capacity });
              this.setState({ capacity });
            }}
            label="Capacity"
          />
        <Button
          style={{ width: '100%', marginTop: 5 }}
          onClick={() => service.buffer = []}
        >
          Clear
        </Button>
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'main', render: this.renderMain }
        ]}
      />
    );
  }
}

class Buffer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.buffer = [];
    this.capacity = 100;
  }

  configure(config) {
    const { capacity } = config;
    if (capacity !== undefined) {
      this.capacity = capacity;
    }
  }

  process(params) {
    this.buffer = this.buffer.concat(params);
    if (this.buffer.length > this.capacity) {
      const diff = this.buffer.length - this.capacity;
      this.buffer = this.buffer.slice(diff);
    }
    return this.buffer;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Buffer(app, board, descriptor, id),
  createUI: BufferUI
};

export default descriptor;
