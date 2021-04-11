import React, { Component } from 'react';

import InputField from '../../components/shared/InputField';
import { FilterDescriptor } from 'services';
import { parseExpression, evalExpression } from 'services/eval';

import ServiceUI from './ServiceUI';

class FilterUI extends Component {
  state = {
  };

  onInit(initialState) {
    const { condition } = initialState;
    this.setState({
      condition,
    });
  }

  onNotification(service, notification) {
    const { condition } = notification;

    if (condition !== undefined) {
      this.setState({
        condition,
      });
    }
  }

  renderMain = service => {
    const { condition } = this.state;
    return (
      <div className="filter-service" style={{ textAlign: 'left' }}>
        <InputField
          type="text"
          label="Predicate"
          value={condition || ''}
          labelPosition="left"
          onChange={(_, { value: condition }) => service.configure({ condition })}
        />
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
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

    this._parsedCondition = undefined;
    this.condition = '';
  }

  configure(config) {
    const { condition } = config;

    if (condition !== undefined) {
      this.condition = condition;
      this._parsedCondition = parseExpression(condition);
      this.app.notify(this, { condition });
    }
  }

  process(params) {
    const filter = x => {
      if (this._parsedCondition && x) {
        return !!evalExpression(this._parsedCondition, { params: x });
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
  serviceName: FilterDescriptor.serviceName,
  serviceId: FilterDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    //new FilterDescriptor.service(app, board, descriptor, id),
    new Filter(app, board, descriptor, id),
  createUI: FilterUI
};

export default descriptor;
