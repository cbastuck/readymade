import React, { Component } from 'react';

import InputField from '../../components/shared/InputField';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

import { s, t } from '../../styles';

import ServiceUI from '../../runtime/services/ServiceUI';

export default class OutputUI extends Component {
  state = {
    name: '',
    active: false
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    this.setState({ name: config.name, active: config.active });
  }

  renderMain = service => {
    const { board, userId } = this.props;
    const { name, active } = this.state;
    return (
      <div>
        <InputField
          type="text"
          label="Name"
          value={name}
          onChange={(_, { value }) => this.setState({ name: value })}
        />
        <InputField
          type="checkbox"
          label="Active"
          value={active}
          onChange={async (_, { value }) => {
            await configureService(board, service, {
              active: value,
              name: this.state.name
            });
            this.update();
          }}
        />
        {
          active && (
            <div 
              style={{ 
                textAlign: 'right',
              }}
            >
              <a
                href={`${window.location.origin}/api/${userId}/${board}/${this.state.name}`}
                target="blank"
                style={s(t.uc, t.lc1, t.fs11)}
              >
                Show Output
              </a>
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
        segments={[
          { name: 'main', render: this.renderMain },
        ]}
      />
    );
  }

}
