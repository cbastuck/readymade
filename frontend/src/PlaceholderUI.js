import React, { Component } from 'react';

export default class PlaceholderUI extends Component {
  render() {
    const { service } = this.props;
    return (
      <div 
        key={service.uuid} 
        id={service.uuid} 
        service={service} 
        style={{ minWidth: 200 }} 
      />
    )
  }
} 