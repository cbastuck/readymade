import React, { Component } from 'react';
import {
  Button
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

export default class HTMLTemplatesUI extends Component {
  state = {
  };

  update = async() => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    const { data } = config;
    this.setState({ data });
  }

  sendConfig = async () => {
    const { board, service } = this.props;
    await configureService(board, service, this.state);
    this.update();
  }

  render() {
    const lineStyle = {
      textAlign: 'left',
      margin: '8px 10px',
    };

    return (
      <div style={{ margin: 15 }}>
        <div style={lineStyle}>
          <Button
            onClick={() => {}}
          >
            TODO
          </Button>
        </div>
      </div>
   );
  }
}
