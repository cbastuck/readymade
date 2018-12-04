import React, { Component } from 'react';

import ServiceDropdown from './ServiceDropdown';

import { getRegistry } from '../core/actions';

export default class Toolbar extends Component {
  state ={};

  componentDidMount() {
    getRegistry()
      .then(registry => this.setState({ registry }));
  }

  render() {
    return (
      <div
        style={{
          width: '100%',
          height: 40,
          border: 'solid 1px gray',
          borderRadius: 3,
          marginBottom: 5,
          textAlign: 'left'
        }}
      >
        <ServiceDropdown
          registry={this.state.registry}
          addService={service =>
            this.props.onAddService({
              ...service,
              operation: 'POST',
              serviceName: 'email',
              selector: { query: 'email' },
            }
          )}
        />
      </div>
    );
  }
}
