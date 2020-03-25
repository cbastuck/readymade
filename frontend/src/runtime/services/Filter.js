import React, { Component } from 'react';
import {
  Input,
} from 'semantic-ui-react';

import evilEval from '../../evilEval';
import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/filter-browser';
const serviceName = 'Filter';

class FilterUI extends Component {
  state = {
    template: {},
    addProperty: null,
  };

  onInit(initialState) {
    const { condition } = initialState;
    this.setState({
      condition,
    });
  }

  renderMain = service => {
    return (
      <div className="filter-service" style={{ textAlign: 'left' }}>
        <Input
          type="text"
          label="Condition"
          value={this.state.condition || ''}
          labelPosition="left"
          onChange={(_, { value: condition }) => this.setState({ condition })}
          onKeyPress={e => e.key === 'Enter' && service.configure({ condition: this.state.condition })}
        />
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

class Filter {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.condition = undefined;
  }

  configure(config) {
    const { condition } = config;
    if (condition !== undefined) {
      this.condition = condition;
    }
  }

  process(params) {
    const f = this.condition;
    const filter = x => {
      if (f && x) {
        return !!evilEval(f, x);
      }
      return false;
    };

    if (Array.isArray(params)) {
      return params.filter(filter);
    }
    
    return filter(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Filter(app, board, descriptor, id),
  createUI: FilterUI
};

export default descriptor;
