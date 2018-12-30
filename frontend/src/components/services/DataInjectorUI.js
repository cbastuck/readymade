import React, { Component } from 'react';
import {
  Button
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';
import { debounce } from  '../shared/util';

const testData = ['eins', 'zwei', 'drei'];

export default class DataInjectorUI extends Component {
  state = {
    data: ['eins', 'zwei', 'drei']
  };

  update = async() => {
    const config = await getServiceConfiguration(this.props.service);
    const { data } = config;
    this.setState({ data });
  }

  sendConfig = debounce(async() => {
    await configureService(this.props.service, this.state);
    this.update();
  });

  render() {
    const lineStyle = {
      textAlign: 'left',
      margin: '8px 10px',
    };

    return (
      <div style={{ margin: 15 }}>
        <div style={lineStyle}>
          <Button
            onClick={() => {
              this.setState(
                { data: testData },
                this.sendConfig
              )
            }}
          >
            Inject Data
          </Button>
        </div>
      </div>
   );
  }
}
