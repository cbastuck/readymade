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
    return (
      <div>
        <div
          style={lineStyle}
        >
          <TextArea
            style={{ width: '100%' }}
            value={this.state.value}
          />
           <Checkbox
              label="active"
              checked={this.state.enabled}
              onChange={(_, { checked: enabled }) => 
                this.setState(
                  { enabled }, 
                  () => configureService(
                    board, service, { enabled: this.state.enabled }
                  )
                )
              }
            />
        </div>
      </div>
   );
  }
}
