import React, { Component } from 'react';
import {
  Input,
  Label
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';
import { debounce } from '../shared/util';

export default class HTMLFilterUI extends Component {
  state = {
    selector: ''
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const config = await getServiceConfiguration(this.props.service);
    this.setState({ selector: config.selector });
  }

  sendConfig = debounce(async () => {
    await configureService(this.props.service, this.state);
    await this.update();
  })

  render() {
    const lineStyle = {
      textAlign: 'left',
      margin: '8px 10px',
    };
    return (
      <div style={lineStyle}>
        <div style={{ marginBottom: 10 }}>
          <Label style={{ width: 60 }}>
            Selector
          </Label>
          <Input
            placeholder='Selector'
            value={this.state.selector}
            style={{ width: 160 }}
            onChange={(_, { value }) =>
              this.setState(
                { selector: value },
                this.sendConfig
              )
            }
          />
        </div>
      </div>
    );
  }
}
