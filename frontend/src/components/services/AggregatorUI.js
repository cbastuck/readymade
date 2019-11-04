import React, { Component } from 'react';
import {
  Button,
  Label
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';
import { debounce } from '../shared/util';

export default class AggregatorUI extends Component {
  state = {
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    this.setState({ selector: config.selector });
  }

  sendConfig = debounce(async () => {
    const { board, service } = this.props;
    await configureService(board, service, this.state);
    await this.update();
  });

  onReset = () => {
    const { board, service } = this.props;
    return configureService(board, service, { reset: true });
  }

  render() {
    const lineStyle = {
      textAlign: 'left',
      margin: '8px 10px',
    };
    return (
      <div style={lineStyle}>
        <div style={{ marginBottom: 10 }}>
          <Button
            style={{ width: 160 }}
            onClick={this.onReset}
          >
            Reset
          </Button>
        </div>
      </div>
    );
  }
}
