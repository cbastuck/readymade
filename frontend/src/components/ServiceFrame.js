import React, { Component } from 'react';

export default class ServiceFrame extends Component {
  state = {
    mouseOver: false
  };

  render() {
    const { position, service } = this.props;
    const width = 200;
    const margin = 20;
    const top = '40%';
    return (
      <div>
        <div
          style={{
            fontSize: '4em',
            position: 'absolute',
            top,
            marginTop: 80,
            left: position * width + (position + 1) * margin - 7,
            color: 'lightgray',
            zIndex: 100,
            backgroundColor: 'white'
          }}
        >
          >
        </div>
        <div
          style={{
            border: 'solid 1px lightgray',
            width,
            height: width,
            borderRadius: 10,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            top,
            position: 'absolute',
            left: position * width + (position + 1) * margin,
            fontSize: 15,
            color: 'black'
          }}
          onMouseOver={() => this.setState({ mouseOver: true })}
          onMouseOut={() => this.setState({ mouseOver: false })}
        >
          { service }
        </div>
      </div>
    );
  }
}
