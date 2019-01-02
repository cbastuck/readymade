import React, { Component } from 'react';
import {
  Button
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';
import PropertySelector from '../shared/PropertySelector';

export default class FilterUI extends Component {
  state = {
    selectedKeys: [],
    keys: [],
    values: []
  };

  componentDidMount() {
    this.sync();
  }

  currentValueForKey = key => {
    const pos = this.state.keys.findIndex(x => x === key);
    return (pos !== -1) && this.state.values[pos];
  }

  configureService = () => {
    const { board, service } = this.props;
    const config = this.state.selectedKeys.reduce(
      (all, key) => {
        const isSelected = this.state.selectedKeys.indexOf(key) !== -1;
        return isSelected ?
          { ...all, [key]: this.currentValueForKey(key)} :
          all;
      },
      {}
    );
    configureService(board, service, config);
  }

  sync = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    const recentInput = config.recentInput;
    if (recentInput) {
      this.setState(
        { recentInput, filter: config.filter },
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
        const selectedKeys = Object.keys(filter);
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
        <PropertySelector
          selectedKeys={this.state.selectedKeys}
          keys={this.state.keys}
          values={this.state.values}
          onValueChanged={(key, value) => {
            const idx = this.state.keys.findIndex(k => k === key);
            const values = Object.assign([], this.state.values, { [idx]: value });
            this.setState({ values })
          }}
          onCheckboxChanged={(key, checked) =>
            this.setState({
              selectedKeys: checked ?
                this.state.selectedKeys.concat(key) :
                this.state.selectedKeys.filter(x => x !== key)
            },
            this.configureService
          )}
        />
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

