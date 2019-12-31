import React, { Component } from 'react';
import { Header } from 'semantic-ui-react';

import './ServiceFrame.css';

export default class ServiceFrame extends Component {
  state = {
    mouseOver: false
  };

  render() {
    const { service } = this.props;
    const top = '18%';
    return (
      <div
        key={`service-frame-${service.uuid}`}
      >
        <div
          className="unselectable"
          style={{
            border: 'solid 1px lightgray',
            borderRadius: 10,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            float: 'left',
            top,
            margin: 10,
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
              marginTop: 5,
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
