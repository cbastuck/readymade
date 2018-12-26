import React, { Component } from 'react';
import {
  Input,
  Label,
  Button,
  Tab,
  TextArea
} from 'semantic-ui-react';

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

export default class MySqlUI extends Component {
  state = {
    createDatabaseName: '',
    createTableName: '',
  };

  componentDidMount() {
    this.getConfig();
  }

  getConfig = async () => {
    const config = await getServiceConfiguration(this.props.service);
    console.log('GOT CONFIG', config);
  }

  createNewInstance = async () => {
    const { service } = this.props;
    const config = {
      createInstanceDetails: {
        databaseName: this.state.createDatabaseName,
        tableName: this.state.createTableName
      }
    };
    const res = await configureService(service, config);
  }

  renderProvisioningTab = () => {
    return (
      <div>
         <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>
            Database
          </Label>
          <Input
            placeholder='Name of Database'
            value={this.state.createDatabaseName}
            onChange={(_, data) => this.setState({
              createDatabaseName: data.value
            })}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>
            Table
          </Label>
          <Input
            placeholder='Name of table'
            value={this.state.createTableName}
            onChange={(_, data) => this.setState({
              createTableName: data.value
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
            onClick={this.createNewInstance}
          >
            Provisioning
          </Button>
        </div>
      </div>
    );
  }

  renderConnectionTab = () => {
    return (
      <div>
         <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>
            Host
          </Label>
          <Input
            placeholder='Name of Database'
            value={this.state.databaseName}
            onChange={(_, data) => this.setState({
              databaseName: data.value
            })}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>
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
      </div>
    );
  }

  render() {
    const panes = [
      { menuItem: 'Create Instance', render: () => <Tab.Pane>{this.renderProvisioningTab()}</Tab.Pane> },
      { menuItem: 'Existing Instance', render: () => <Tab.Pane>{this.renderConnectionTab()}</Tab.Pane> },
    ]
    return (
      <div>
        <Tab panes={panes} />
      </div>
    );
  }
}
