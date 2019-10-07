import React, { Component } from 'react';
import {
  TextArea,
} from 'semantic-ui-react';

import {
  getServiceConfiguration
} from '../../core/actions';

export default class MonitorUI extends Component {
  state = {
    value: ''
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
    const { board, service } = this.props;
    if (service && service.board) {
      const config = await getServiceConfiguration(board, service);

      this.eventSource = new EventSource(`/api/${service.board}/${config.uuid}`);
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

    return (
      <div>
        <div
          style={lineStyle}
        >
          <TextArea
            style={{ width: '100%' }}
            value={this.state.value}
          />
        </div>
      </div>
   );
  }
}
