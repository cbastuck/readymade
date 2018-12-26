import React, { Component } from 'react';
import {
  Table,
  Menu,
  Icon,
  Input,
  Checkbox,
} from 'semantic-ui-react';


export default class PropertySelector extends Component {

  state = {
    currentPage: 0,
    numPropertiesPerPage: 5,
  };

  renderCheckbox = idx => {
    const { keys, onCheckbox } = this.props;
    return (
      <div
        style={{
          textAlign: 'center'
        }}
      >
        <Checkbox
          slider
          onChange={(_, { checked }) => onCheckbox(keys[idx], checked)}
          checked={this.props.selectedKeys[keys[idx]]}
        />
      </div>
    );
  }

  renderRuleValue = idx => {
    const { values, keys, onCheckbox, onValues} = this.props;
    return (
      <Input
        value={values[idx]}
        onChange={(_, data) => {
          onCheckbox(keys[idx], false);
          onValues(Object.assign([], values, {[idx]: data.value}));
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
    const { keys } = this.props;
    const { currentPage, numPropertiesPerPage } = this.state;
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
    const { keys } = this.props;
    const numPages = keys ?
      Math.ceil(keys.length / this.state.numPropertiesPerPage) :
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

  render = () => {
    const { keys, values } = this.props;
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

}
