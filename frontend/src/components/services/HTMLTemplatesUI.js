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
    const config = await getServiceConfiguration(this.props.service);
    const { data } = config;
    this.setState({ data });
  }

  sendConfig = async () => {
    await configureService(this.props.service, this.state);
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
