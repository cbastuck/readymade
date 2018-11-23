import React, { Component } from 'react';

export default class Toolbar extends Component {
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
        <button
          style={{
            height: '85%',
            width: 35,
            margin: 3,
            borderRadius: 3,
          }}
          onClick={() => this.props.onAddDevice('device')}
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
