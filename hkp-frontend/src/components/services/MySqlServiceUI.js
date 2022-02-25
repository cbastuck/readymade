import React, { Component } from "react";
import { Input, Label, Button, Tab } from "semantic-ui-react";

import { configureService, getServiceConfiguration } from "../../core/actions";
import PropertySelector from "../shared/PropertySelector";

const lineStyle = {
  textAlign: "left",
  margin: 10,
};
const labelStyle = {
  width: 70,
};

export default class MySqlServiceUI extends Component {
  state = {
    host: "192.168.178.21",
    databaseName: "hookup",
    tableName: "hookup",
    user: "root",
    password: "hookup",
    currentTab: 0,
    selectedQueryKeys: [],
  };

  componentDidMount() {
    this.getConfig();
  }

  getConfig = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);

    const keys = config.sample ? Object.keys(config.sample) : [];
    const values = keys.map((key) => config.sample[key]);

    this.setState({
      connection: config.connectionDetails,
      currentTab: config.connectionDetails ? 1 : 0,
      keys,
      values,
    });
  };

  connectToInstance = (details) => {
    const { host, databaseName, tableName, user, password } = details;
    const { board, service } = this.props;
    return configureService(board, service, {
      host,
      databaseName,
      tableName,
      user,
      password,
    });
  };

  doQuery = () => {
    const keys = this.state.keys;
    const values = this.state.values;
    if (this.state.selectedQueryKeys.length > 0) {
      const query = this.state.selectedQueryKeys.reduce(
        (all, key) => ({
          ...all,
          [key]: values[keys.indexOf(key)],
        }),
        {}
      );
      const { board, service } = this.props;
      return configureService(board, service, { query });
    }
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
                : this.state.host || ""
            }
            onChange={(_, data) =>
              this.setState({
                host: data.value,
              })
            }
            disabled={!!this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Database</Label>
          <Input
            placeholder="Name of Database"
            value={
              this.state.connection
                ? this.state.connection.databaseName
                : this.state.databaseName
            }
            onChange={(_, data) =>
              this.setState({
                databaseName: data.value,
              })
            }
            disabled={!!this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Table</Label>
          <Input
            placeholder="Name of Table"
            value={
              this.state.connection
                ? this.state.connection.tableName
                : this.state.tableName
            }
            onChange={(_, data) =>
              this.setState({
                tableName: data.value,
              })
            }
            disabled={!!this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>User</Label>
          <Input
            placeholder="User"
            value={
              this.state.connection
                ? this.state.connection.user
                : this.state.user
            }
            onChange={(_, data) =>
              this.setState({
                user: data.value,
              })
            }
            disabled={!!this.state.connection}
          />
        </div>
        <div style={{ ...lineStyle }}>
          <Label style={labelStyle}>Password</Label>
          <Input
            type="password"
            placeholder="Password"
            value={
              this.state.connection
                ? this.state.connection.password
                : this.state.password
            }
            onChange={(_, data) =>
              this.setState({
                password: data.value,
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
            onClick={() => this.connectToInstance(this.state)}
            disabled={!!this.state.connection}
          >
            Connect
          </Button>
        </div>
      </div>
    );
  };

  renderQueryTab = () => {
    return (
      <div>
        <PropertySelector
          keys={this.state.keys}
          values={this.state.values}
          selectedKeys={this.state.selectedQueryKeys}
          onCheckboxChanged={(key, checked) =>
            checked
              ? this.setState({
                  selectedQueryKeys: this.state.selectedQueryKeys.concat(key),
                })
              : this.setState({
                  selectedQueryKeys: this.state.selectedQueryKeys.filter(
                    (x) => x !== key
                  ),
                })
          }
          onValueChanged={(key, value) =>
            this.setState({
              values: this.state.values.map((v, i) =>
                this.state.keys[i] === key ? value : v
              ),
            })
          }
        />
        <div
          style={{
            ...lineStyle,
            textAlign: "center",
          }}
        >
          <Button
            onClick={this.doQuery}
            disabled={!this.state.connection || !this.state.keys}
          >
            Execute
          </Button>
        </div>
      </div>
    );
  };

  render() {
    const panes = [
      {
        menuItem: "Connection",
        render: () => <Tab.Pane>{this.renderConnectionTab()}</Tab.Pane>,
      },
      {
        menuItem: "Query",
        render: () => <Tab.Pane>{this.renderQueryTab()}</Tab.Pane>,
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
