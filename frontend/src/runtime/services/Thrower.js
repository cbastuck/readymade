import React, { Component } from 'react';

import InputField from '../../components/shared/InputField';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/thrower';
const serviceName = 'Thrower';

class ThrowerUI extends Component {
  state = { 
    wall: '',
    id: ''
  };

  onInit = initial => {

  }

  onNotification = (service, notification) => {
    
  }

  renderMain = () => {
    const { 
      wall,
      id,
    } = this.state;
    return (
      <div style={s(t.fill, {display: 'flex', flexDirection: 'column' })}>
        <InputField
          label="Wall"
          value={wall}
          onChange={(ev, { value: wall }) => this.setState({ wall })}
        />
        <InputField
          label="Id"
          value={id}
          onChange={(ev, { value: id }) => this.setState({ id })}
        />
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'main', render: this.renderMain }
        ]}
      />
    );
  }
}


class Thrower {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure = (config) => {
  }

  destroy = () => {
  }

  process(params) {
  }
}


const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Thrower(app, board, descriptor, id),
  createUI: ThrowerUI
};

export default descriptor;
