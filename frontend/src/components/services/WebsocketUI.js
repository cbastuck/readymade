import React, { Component } from 'react';

import InputField from '../../components/shared/InputField';

//import { s, t } from '../../styles';
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
    return (
      <div>
        <InputField
          type="text"
          label="Name"
          value={url}
        />
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
