import React, { Component } from 'react';
import {
  Button,
} from 'semantic-ui-react';

import { 
  serviceName, 
  serviceId,
  Buffer 
} from 'services/Buffer';

import { List } from 'semantic-ui-react';
import InputField from '../../components/shared/InputField';
import { s, t } from '../../styles';

import ServiceUI from './ServiceUI';

class BufferUI extends Component {
  state = { 
    capacity: 0,
    items: [{ name: 'me' }, { name: 'you' }],
  };

  onInit = initialState => {
    const { capacity } = initialState;
    this.setState({
      capacity,
    });
  }

  onNotification = async (service, notification) => {   
    const items = await service.configure({ action: 'getBuffer' });
    this.setState({ items });
  }

  renderBuffer = service => {
    const { items } = this.state;
    return (
      <List
        style={s(t.fill)}
        verticalAlign="middle"
        divided
      >
        {
          items.map((item, idx) => (
            <List.Item key={`buffer-list-item-${idx}`}>
              <List.Content>
                { JSON.stringify(item) }
              </List.Content>
            </List.Item>
          ))
        }
      </List>
    );
  }

  renderMain = service => {
    return (
      <div>
        <InputField
            type="number"
            value={this.state.capacity}
            onChange={(_, { value }) => {
              const capacity = value !== '' && Number(value);
              service.configure({ capacity });
              this.setState({ capacity });
            }}
            label="Capacity"
            unit="items"
          />
        <Button
          style={s(t.w100, t.mt5, t.uc, t.ls1, t.fs11)}
          onClick={() => service.buffer = []}
        >
          Clear
        </Button>
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
          { name: 'main', render: this.renderMain },
          { name: 'buffer', render: this.renderBuffer },
        ]}
      />
    );
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Buffer(app, board, descriptor, id),
  createUI: BufferUI
};

export default descriptor;
