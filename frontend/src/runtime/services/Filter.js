import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';

import evilEval from '../../evilEval';
import ServiceUI from './ServiceUI';
import './Map.css';

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

  render() {
    const marginStyle = { margin: '10px 5px' };
    const vspace = { marginBottom: 5 }
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div className="filter-service" style={marginStyle}>
            <Input
              style={{ ...vspace, width: '100%' }}
              type="text"
              value={this.state.condition || ''}
              labelPosition="left"
              onChange={(_, { value: condition }) => this.setState({ condition })}
              onKeyPress={e => e.key === 'Enter' && service.configure({ condition: this.state.condition })}
            />
          </div>
        )
      }
      </ServiceUI>
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
