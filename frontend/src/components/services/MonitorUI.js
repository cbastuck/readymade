import React, { Component } from 'react';
import {
  TextArea,
  Checkbox,
} from 'semantic-ui-react';

import {
  getServiceConfiguration,
  configureService,
} from '../../core/actions';

export default class MonitorUI extends Component {
  state = {
    value: '',
    enabled: undefined,
  }

  componentDidMount() {
    this.connectEventSource();
  }

  componentWillUnmount() {
    if (this.eventSource) {
      this.eventSource.removeEventListener(
        'data',
        this.onMessage
      );
      this.eventSource.close();
    }
  }

  onMessage = e => {
    let data = e.data;
    try {
      const incoming = JSON.parse(e.data);
      if (incoming && incoming.action === 'ping') {
        return; // filter pings
      }
      data = incoming; 
    } catch (e) {
    }
    this.setState({ value: data });
  }

  connectEventSource = async () => {
    const { board, service, userId } = this.props;
    if (service && service.board) {
      const config = await getServiceConfiguration(board, service);
      this.setState({ enabled: config.enabled });
      this.eventSource = new EventSource(`/api/${userId}/${service.board}/${config.uuid}`);
      this.eventSource.addEventListener(
        'data',
        this.onMessage
      );
    }
  }

  render() {
    const lineStyle = {
      textAlign: 'left',
      marginBottom: 10,
      padding: 10,
    };
    const { board, service } = this.props;
    const { value, enabled } = this.state;
    return (
      <div>
        <div style={lineStyle}>
          <TextArea
            style={{ width: '100%' }}
            value={value}
          />
           <Checkbox
            label="active"
            checked={enabled}
            onChange={(_, { checked }) => 
              this.setState(
                { enabled: checked }, 
                () => configureService(
                  board, service, { enabled: checked }
                )
              )
            }
            />
        </div>
      </div>
   );
  }
}
