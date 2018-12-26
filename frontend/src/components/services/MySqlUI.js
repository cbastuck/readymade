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
    this.setState({ connection: config.connectionDetails });
  }

  createNewInstance = async () => {
    const { service } = this.props;
    const config = {
      createInstanceDetails: {
        databaseName: this.state.createDatabaseName,
        tableName: this.state.createTableName
      }
    };
    await configureService(service, config);
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
            disabled={this.state.connection}
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
            disabled={this.state.connection}
          />
        </div>
        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <Button
            onClick={this.createNewInstance}
            disabled={this.state.connection}
          >
            Provision
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
            placeholder='Host'
            value={this.state.connection ?
              this.state.connection.host :
              this.state.existingHost
            }
            onChange={(_, data) => this.setState({
              databaseName: data.value
            })}
            disabled={this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>
            Database
          </Label>
          <Input
            placeholder='Name of Database'
            value={this.state.connection ?
              this.state.connection.tableName :
              this.state.tableName
            }
            onChange={(_, data) => this.setState({
              tableName: data.value
            })}
            disabled={this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>
            Table
          </Label>
          <Input
            placeholder='Name of Table'
            value={this.state.connection ?
              this.state.connection.tableName :
              this.state.tableName
            }
            onChange={(_, data) => this.setState({
              tableName: data.value
            })}
            disabled={this.state.connection}
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
        <Tab
          panes={panes}
          activeIndex={this.state.connection ? 1 : 0}
        />
      </div>
    );
  }
}
