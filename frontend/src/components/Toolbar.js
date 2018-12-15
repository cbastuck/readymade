import React, { Component } from 'react';

import ServiceDropdown from './ServiceDropdown';

import { getRegistry } from '../core/actions';

export default class Toolbar extends Component {
  state = {
  };

  componentDidMount() {
    getRegistry()
      .then(registry => this.setState({ registry }));
  }

  render() {
    return (
      <div
        style={{
          width: '100%',
          marginBottom: 5,
          textAlign: 'left'
        }}
      >
        <ServiceDropdown
          registry={this.state.registry}
          addService={service => this.props.onAddService(service)}
          onAccount={this.props.onAccount}
        />
      </div>
    );
  }
}
