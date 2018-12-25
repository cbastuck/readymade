import React, { Component } from 'react';
import {
  Table,
  Menu,
  Icon,
  Input,
  Checkbox,
  Button
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

export default class FilterUI extends Component {
  state = {
    currentPage: 0,
    selectedKeys: {},
    numPropertiesPerPage: 5,
  };

  componentDidMount() {
    this.sync();
  }

  currentValueForKey = key => {
    const pos = this.state.keys.findIndex(x => x === key);
    return (pos !== -1) && this.state.values[pos];
  }

  configureService = () => {
    const config = Object.keys(this.state.selectedKeys).reduce(
      (all, key) => {
        const isSelected = this.state.selectedKeys[key];
        return isSelected ?
          { ...all, [key]: this.currentValueForKey(key)} :
          all;
      },
      {}
    );
    configureService(this.props.service, config);
  }

  renderCheckbox = idx => {
    return (
      <div
        style={{
          textAlign: 'center'
        }}
      >
        <Checkbox
          slider
          onChange={(_, { checked }) =>
            this.setState({
              selectedKeys: {
                ...this.state.selectedKeys,
                [this.state.keys[idx]]: checked
              }
            }, this.configureService)
          }
          checked={this.state.selectedKeys[this.state.keys[idx]]}
        />
      </div>
    );
  }

  renderRuleValue = idx => {
    return (
      <Input
        value={this.state.values[idx]}
        onChange={(_, data) => {
          this.setState({
            values: Object.assign([], this.state.values, {[idx]: data.value}),
            selectedKeys: {
              ...this.state.selectedKeys,
              [this.state.keys[idx]]: false
            }
          })
        }}
      />
    );
  }

  renderHeader = () => {
    return (
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Property</Table.HeaderCell>
          <Table.HeaderCell>Condition</Table.HeaderCell>
          <Table.HeaderCell>Value</Table.HeaderCell>
          <Table.HeaderCell>Enabled</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
    );
  }

  renderBody = () => {
    const { keys, currentPage, numPropertiesPerPage } = this.state;
    const startIdx = currentPage * numPropertiesPerPage;
    return (
      <Table.Body>
        {
          keys.slice(startIdx, startIdx + numPropertiesPerPage)
            .map((key, idx) => (
              <Table.Row
                key={key}
              >
                <Table.Cell>{key}</Table.Cell>
                <Table.Cell>Equals</Table.Cell>
                <Table.Cell>{this.renderRuleValue(startIdx + idx)}</Table.Cell>
                <Table.Cell>{this.renderCheckbox(startIdx + idx)}</Table.Cell>
              </Table.Row>
            ))
        }
      </Table.Body>
    );
  }

  renderFooter = () => {
    const numPages = this.state.recentInput ?
      Math.ceil(Object.keys(this.state.recentInput).length / this.state.numPropertiesPerPage) :
      0;

    return (
      <Table.Footer>
        <Table.Row>
          <Table.HeaderCell colSpan={4}>
            <Menu floated='right' pagination>
              <Menu.Item
                as='a'
                icon
                onClick={() => {
                  this.setState(
                    { currentPage: this.state.currentPage - 1}
                  )
                }}
                disabled={this.state.currentPage < 1}
              >
                <Icon name='chevron left' />
              </Menu.Item>
              {
                numPages > 0 && (
                  new Array(numPages)
                    .fill(null)
                    .map((_, idx) => (
                      <Menu.Item
                        key={idx}
                        as='a'
                        active={idx === this.state.currentPage}
                        onClick={() =>
                          this.setState(
                            { currentPage: idx}
                          )
                        }
                      >
                        {idx}
                      </Menu.Item>
                    ))
                )
              }
              <Menu.Item
                as='a'
                icon
                onClick={() => {
                  this.setState(
                    { currentPage: this.state.currentPage + 1}
                  )
                }}
                disabled={this.state.currentPage >= numPages -1}
              >
                <Icon name='chevron right' />
              </Menu.Item>
            </Menu>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Footer>
    );
  }

  renderTable = () => {
    const { keys, values } = this.state;
    if (!keys || !values) {
      return false;
    }

    return (
      <Table
        celled
        style={{
          maxWidth: 100
        }}
      >
        { this.renderHeader() }
        { this.renderBody() }
        { this.renderFooter() }
      </Table>
    );
  }

  sync = async () => {
    const { service } = this.props;
    const config = await getServiceConfiguration(service);
    const recentInput = config.recentInput;
    if (recentInput) {
      this.setState(
        { recentInput, filter: config.filter, currentPage: 0 },
        this.updateKeyValues
      );
    } else {
      setTimeout(this.sync, 1000);
    }
  }

  updateKeyValues = () => {
    const { recentInput, filter } = this.state;
    if (recentInput) {
      const keys = Object.keys(recentInput);
      const values = keys.map(key => {
        const value = recentInput[key];
        return typeof value === 'object' ?
          JSON.stringify(value) :
          value.toString();
      });
      if (filter) {
        const filterValues = keys.map((key, idx) => {
          const filterValue = filter[key];
          return filterValue ? filterValue : values[idx]
        });
        const selectedKeys = Object.keys(filter).reduce((all, cur) => ({...all, [cur]: true}), {});
        this.setState({ keys, values: filterValues, selectedKeys });
      } else {
        this.setState({ keys, values });
      }
    }
  }

  render() {
    const lineStyle = {
      textAlign: 'center',
      marginBottom: 10,
    };
    const { service } = this.props;
    return (
      <div
        style={lineStyle}
      >
        { this.renderTable() }
        <div style={lineStyle}>
          <Button
            onClick={() => configureService(service, {})}
          >
            Clear Filter
          </Button>
        </div>
      </div>
    );
  }
}

