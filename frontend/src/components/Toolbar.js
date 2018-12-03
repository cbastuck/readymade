import React, { Component } from 'react';

import { Dropdown } from 'semantic-ui-react'
import MyDropdown from './Dropdown';

import { getRegistry } from '../core/actions';

export default class Toolbar extends Component {
  componentDidMount() {
    getRegistry()
      .then(registry => this.setState({ registry }))
      .then(() => console.log('!---', this.state))
  }

  onAddButton = () => {
    const desc = this.state.registry['node'][0]; // TODO
    this.props.onAddService({
      ...desc,
      operation: 'POST',
      serviceName: 'email',
      selector: { query: 'email' },
    });
  }

  render() {
    return (
      <div
        style={{
          width: '100%',
          height: 40,
          border: 'solid 1px gray',
          borderRadius: 3,
          marginBottom: 5,
          textAlign: 'left'
        }}
      >
        <MyDropdown />
        <Dropdown
          placeholder='Service'
          search
          selection
          options={
            this.state &&
            this.state.registry &&
            Object.keys(this.state.registry).map(
              runtime =>
                ({
                  key: runtime,
                  value: runtime,
                  text: runtime
                })
            )
          }
      />
        <button
          style={{
            height: '85%',
            width: 35,
            margin: 3,
            borderRadius: 3,
          }}
          onClick={this.onAddButton}
        >
          +
        </button>
        <button
          style={{
            height: '85%',
            width: 35,
            margin: 3,
            borderRadius: 3,
          }}
          onClick={() => this.props.enterAddConnectionMode()}
        >
          #
        </button>
        <button
          style={{
            height: '85%',
            width: 35,
            margin: 3,
            borderRadius: 3,
          }}
          onClick={() => this.props.onRefresh()}
        >
          U
        </button>

      </div>
    );
  }
}
