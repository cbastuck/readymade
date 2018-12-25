import React, { Component } from 'react';
import {
  TextArea,
} from 'semantic-ui-react';

import {
  getServiceConfiguration
} from '../../core/actions';

export default class DebugUI extends Component {
  constructor(props) {
    super(props);

    this.state = {
      value: ''
    }
    this.connectEventSource();
  }

  connectEventSource = async () => {
    const { service } = this.props;

    const config = await getServiceConfiguration(service);
    this.eventSource = new EventSource(`/api/${service.board}/${config.name}`);

    this.eventSource.addEventListener(
      'test',
      e => this.setState({ value: e.data })
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
