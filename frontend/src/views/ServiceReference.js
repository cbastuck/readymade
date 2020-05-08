import React, { Component } from 'react';

export default class ServiceReference extends Component {
  render() {
    const { match } = this.props;
    const { params } = match || {}; 
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          padding: 5
        }}
      >
        <h1>Service Reference</h1>
        <div>
          Document the behavior of service { params.service } here
        </div>
      </div>
    );
  }
}