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
      this.eventSource.close();
      this.eventSource.removeEventListener(
        'data',
        this.onMessage
      );
    }
  }

  onMessage = e => {
    this.setState({ value: e.data });
  }

  connectEventSource = async () => {
    const { board, service } = this.props;

    const config = await getServiceConfiguration(board, service);
    this.eventSource = new EventSource(`/api/${service.board}/${config.name}`);

    this.eventSource.addEventListener(
      'data',
      this.onMessage
    );
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
