import React, { Component } from "react";
import { Input, Label, Button, Tab } from "semantic-ui-react";

import { configureService, getServiceConfiguration } from "../../core/actions";

const lineStyle = {
  textAlign: "left",
  margin: 10,
};
const labelStyle = {
  width: 70,
};

export default class MySqlResourceUI extends Component {
  state = {
    createDatabaseName: "",
    createTableName: "",
    currentTab: 0,
  };

  componentDidMount() {
    this.getConfig();
  }

  getConfig = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    this.setState({
      connection: config.connectionDetails,
      currentTab: config.connectionDetails ? 1 : 0,
    });
  };

  createNewInstance = async () => {
    const { board, service } = this.props;
    const config = {
      createInstanceDetails: {
        databaseName: this.state.createDatabaseName,
        tableName: this.state.createTableName,
      },
    };
    await configureService(board, service, config);
  };

  renderProvisioningTab = () => {
    return (
      <div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Database</Label>
          <Input
            placeholder="Name of Database"
            value={this.state.createDatabaseName}
            onChange={(_, data) =>
              this.setState({
                createDatabaseName: data.value,
              })
            }
            disabled={!!this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Table</Label>
          <Input
            placeholder="Name of table"
            value={this.state.createTableName}
            onChange={(_, data) =>
              this.setState({
                createTableName: data.value,
              })
            }
            disabled={!!this.state.connection}
          />
        </div>
        <div
          style={{
            ...lineStyle,
            textAlign: "center",
          }}
        >
          <Button
            onClick={this.createNewInstance}
            disabled={!!this.state.connection}
          >
            Deploy
          </Button>
        </div>
      </div>
    );
  };

  renderConnectionTab = () => {
    return (
      <div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Host</Label>
          <Input
            placeholder="Host"
            value={
              this.state.connection
                ? this.state.connection.host
                : this.state.existingHost || ""
            }
            disabled
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Database</Label>
          <Input
            placeholder="Name of Database"
            value={this.state.connection ? this.state.connection.tableName : ""}
            disabled
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Table</Label>
          <Input
            placeholder="Name of Table"
            value={this.state.connection ? this.state.connection.tableName : ""}
            disabled
          />
        </div>
      </div>
    );
  };

  render() {
    const panes = [
      {
        menuItem: "Create Instance",
        render: () => <Tab.Pane>{this.renderProvisioningTab()}</Tab.Pane>,
      },
      {
        menuItem: "Deployed Instance",
        render: () => <Tab.Pane>{this.renderConnectionTab()}</Tab.Pane>,
      },
    ];
    return (
      <div>
        <Tab
          panes={panes}
          activeIndex={this.state.currentTab}
          onTabChange={(e, { activeIndex }) =>
            this.setState({ currentTab: activeIndex })
          }
        />
      </div>
    );
  }
}
