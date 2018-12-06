import React, { Component } from 'react';
import { Dropdown, Input } from 'semantic-ui-react';

import { currentBoardName } from '../../core/actions';

export default class extends Component {
  render() {
    const { service } = this.props;
    const path = service && service.path.split(currentBoardName())[1];
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <div
          style={{
            marginTop: 10,
            marginBottom: '15%'
          }}
        >
          {service.serviceName}
        </div>
        <div>
          <Dropdown
            className="left"
            placeholder='Operation'
            options={[
              { key: 'GET', value: 'GET', text: 'GET' },
              { key: 'POST', value: 'POST', text: 'POST' },
              { key: 'DELETE', value: 'DELETE', text: 'DELETE' },
              { key: 'PUT', value: 'PUT', text: 'PUT' },
            ]}
            value={service.op.toUpperCase()}
          />
          <Input
            placeholder='Path'
            value={path}
            style={{ width: '75%' }}
          />
        </div>
      </div>
   );
  }
}
