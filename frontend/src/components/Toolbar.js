import React, { Component } from 'react';

import ServiceDropdown from './ServiceDropdown';

import QR from './QR';
import { getRegistry } from '../core/actions';

export default class Toolbar extends Component {
  state = {
    qrCodeVisible: false
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
          onAction={action => {
            switch (action) {
              case 'showQRCode':
                return this.setState({ qrCodeVisible: true });
              default:
                break;
            }
          }}
        />
        {
          this.state.qrCodeVisible && (
            <QR
              onClick={() => this.setState({ qrCodeVisible: false })}
            />
          )
        }
      </div>
    );
  }
}
