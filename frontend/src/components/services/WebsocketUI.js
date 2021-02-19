import React, { Component } from 'react';

import InputField from '../../components/shared/InputField';

//import { s, t } from '../../styles';
import ServiceUI from '../../runtime/services/ServiceUI';

export default class WebsocketUI extends Component {
  state = {
    name: '',
  };

  onInit = initial => {
    const { name='' } = initial;
    this.setState({ name });
  }

  onNotification = (service, notification) => {
  }

  renderMain = service => {
    const { name } = this.state;
    return (
      <div>
        <InputField
          type="text"
          label="Name"
          value={name}
          onChange={async (_, { value: name }) => {
            await service.configure({ name });
            this.setState({ name });
          }}
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
