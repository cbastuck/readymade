import React, { Component } from 'react';

// import InputField from '../../components/shared/InputField';

import { s, t } from '../../styles';
import ServiceUI from '../../runtime/services/ServiceUI';

export default class WebsocketUI extends Component {
  state = {
    url: '',
  };

  onInit = initial => {
    const { url='' } = initial;
    this.setState({ url });
  }

  onNotification = (service, notification) => {
    console.log('On Notification ', notification)
  }

  renderMain = service => {
    const { url } = this.state;
    const { protocol, host } = window.location;
    const wsProtocol = protocol.indexOf('https') === 0 ? 'wss' : 'ws';
    const full = `${wsProtocol}://${host}${url}`;
    return (
      <div>
      {
        url && (
                <div style={s(t.fs11, t.mt2, { userSelect: 'text', textAlign: 'left' })}>
                  { `${full}` }
                </div>
              )
      }
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        { ...this.props }
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'main', render: this.renderMain },
        ]}
      />
    );
  }

}
