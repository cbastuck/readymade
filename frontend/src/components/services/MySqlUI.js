import React, { Component } from 'react';
import {
  Table,
  Menu,
  Icon,
  Input,
  Label,
  Checkbox,
  Button,
  TextArea
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

export default class MySqlUI extends Component {
  state = {
    tableName: undefined
  };

  componentDidMount() {
    this.getConfig();
  }

  getConfig = async () => {
    const config = await getServiceConfiguration(this.props.service);
    console.log('GOT CONFIG', config);
  }

  render() {
    const { service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      margin: 10,
    };
    const labelStyle = {
      width: 70
    };
    return (
      <div>
         <div
          style={{ ...lineStyle }}
        >
          <Label
            style={labelStyle}
          >
            Database
          </Label>
          <Input
            placeholder='Name of Database'
            value={this.state.databaseName}
            onChange={(_, data) => this.setState({
              databaseName: data.value
            })}
          />
        </div>
        <div
          style={{ ...lineStyle }}
        >
          <Label
            style={labelStyle}
          >
            Table
          </Label>
          <Input
            placeholder='Name of table'
            value={this.state.tableName}
            onChange={(_, data) => this.setState({
              tableName: data.value
            })}
          />
        </div>
        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <Button
            style={{ width: 210 }}
            onClick={async () => {
              const config = await configureService(service, this.state);
              this.setState({ ...config });
            }}
          >
            Configure
          </Button>
        </div>
      </div>
    );
  }
}
