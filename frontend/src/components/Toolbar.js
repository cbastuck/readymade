import React, { Component } from 'react';

const selectedServiceDesc = {
  serviceId: 'hookup.to/service/rest-endpoint',
  operation: 'POST',
  serviceName: 'email',
  selector: { query: 'email' }
};

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
          onClick={() => this.props.onAddService(selectedServiceDesc)}
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
