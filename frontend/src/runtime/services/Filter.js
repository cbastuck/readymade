import React, { Component } from 'react';
import {
  Input,
} from 'semantic-ui-react';

import { FilterDescriptor } from 'services';

import ServiceUI from './ServiceUI';

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


const descriptor = {
  serviceName: FilterDescriptor.serviceName,
  serviceId: FilterDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new FilterDescriptor.service(app, board, descriptor, id),
  createUI: FilterUI
};

export default descriptor;
