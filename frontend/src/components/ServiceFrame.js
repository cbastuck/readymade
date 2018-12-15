import React, { Component } from 'react';
import { Header } from 'semantic-ui-react';

export default class ServiceFrame extends Component {
  state = {
    mouseOver: false
  };

  render() {
    const { position, service } = this.props;
    const width = 230;
    const margin = 20;
    const top = '40%';
    return (
      <div
        key={`service-frame-${service.uuid}`}
      >
        <div
          style={{
            fontSize: '3em',
            position: 'absolute',
            top,
            marginTop: '7%',
            marginLeft: -8,
            left: position * width + (position + 1) * margin - 7,
            color: 'lightgray',
            zIndex: 100,
          }}
        >
          >
        </div>
        <div
          style={{
            border: 'solid 1px lightgray',
            width,
            borderRadius: 10,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            top,
            position: 'absolute',
            left: position * width + (position + 1) * margin,
            fontSize: 15,
            color: 'black'
          }}
          onMouseOver={() => this.setState({ mouseOver: true })}
          onMouseOut={() => this.setState({ mouseOver: false })}
        >
          <div
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <div
            style={{
              marginTop: 15,
              marginBottom: 20
            }}
          >
            <Header as='h3' dividing>
              { service.props.service.serviceName }
            </Header>
          </div>
          { service }
        </div>
      </div>
      </div>
    );
  }
}
