import React, { Component } from 'react';
import {
  Input,
  Label,
  Button,
  Tab
} from 'semantic-ui-react';
import moment from 'moment';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

const lineStyle = {
  textAlign: 'left',
  margin: 10,
};
const labelStyle = {
  width: 70
};

export default class TimerUI extends Component {
  state = {
    rateInMsec: 1000,
  };

  componentDidMount() {
    this.getConfig();
  }

  getConfig = async () => {
    const config = await getServiceConfiguration(this.props.service);

    this.setState({

    });
  }

  render() {
    return (
      <div>

      </div>
    );
  }
}
