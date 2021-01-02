import React, { Component } from 'react';

import ServiceFrame from '../components/ServiceFrame';
import { createServiceUI, createPlaceholderUI } from '../UIFactory';

class DropBar extends Component {
  state = {
    active: false
  };

  render() {
    const { active } = this.state;
    const { onDrop, index } = this.props;
    return (
      <div 
        style={{ 
          width: 20,
          height: '94%',
          margin: '10px 0px',
          borderRadius: 3,
          background: active && 'linear-gradient(to right, #fff 0%, #fff 40%, #4183c4 50%, #fff 60%)'
        }}
        onDragOver={ev => {
          this.setState({ active: true });
          ev.preventDefault();
        }}
        onDragLeave={ev => this.setState({ active: false })}
        onDrop={ev => {
          this.setState({ active: false });
          const data = ev.dataTransfer.getData('text/plain');
          if (data) {
            const svc = JSON.parse(data);
            onDrop && onDrop(svc.uuid, index);
          }
        }}
      />
    );
  }
}

export default class ServiceContainer extends Component {
  render() {
    const {
      services=[], 
      readonly=false,
      boardName,
      runtimeId,
      userId,
      onDrop,
    } = this.props;

    return services.map((service, pos) => {
        const serviceUi = readonly ? 
          createPlaceholderUI(service) :
          createServiceUI(boardName, service, runtimeId, userId)
        return (
          <div 
            key={`scene-frame-${service.uuid}`}
            style={{ display: 'flex', flexDirection: 'row' }}
          >
            { pos === 0 && <DropBar index={0} onDrop={onDrop} /> }
            <ServiceFrame
              service={service}
              serviceUi={serviceUi}
              onAction={this.onServiceAction}
            />
            <DropBar index={pos+1} onDrop={onDrop} />
          </div>
        );
      });
  }
}