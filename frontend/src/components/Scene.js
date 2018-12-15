import React, { Component } from 'react';

import ServiceFrame from './ServiceFrame';

export default class Scene extends Component {
  render() {
    const { children } = this.props;
    return (
      <div
        style={{
          height: '94%',
          width: '100%',
          border: 'solid 1px lightgray',
          borderRadius: 3
        }}
      >
        {
          children && children.map(
            (service, idx) => (
              <ServiceFrame
                key={`scene-frame-${service.uuid}`}
                service={service}
                position={idx}
              />
            )
          )
        }
      </div>
    );
  }
}
