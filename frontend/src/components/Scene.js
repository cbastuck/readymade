import React, { Component } from 'react';

import ServiceFrame from './ServiceFrame';

export default class Scene extends Component {
  render() {
    const { children, runtime, wrap=false, style } = this.props;
    return (
      <div
        style={{
          // height: '93%',
          border: 'solid 1px lightgray',
          borderRadius: 3,
          backgroundColor: '#EEEEEE10',
          padding: 10,
          ...style
        }}
      >
        <h3>{runtime}</h3>
        <div
          style={{
            display: 'flex',
            flexFlow: wrap ? 'row wrap' : 'row nowrap',
            overflow: 'auto',
          }}
        >
        {
          children && children.map(
            (service, idx) => {
              return <ServiceFrame
                key={`scene-frame-${service.props.service.uuid}`}
                service={service}
              />
            }
          )
        }
        </div>
      </div>
    );
  }
}
