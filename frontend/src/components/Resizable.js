import React, { Component } from 'react';

import { s, t } from '../styles';

/*
class Triangle extends Component {
  render() {
    const { 
      height=10,
      width=10
    } = this.props;
    return (
      <svg 
        height={height}
        width={width}
      >
        <polygon 
          points={`0,${height} ${width},${height} ${width},0`}
          style={{ 
            fill:'#efefef',
            stroke:'lightgray',
            strokeWidth: 1
          }} 
        />
      </svg>
    );
  }
}
*/

export default class Resizable extends Component {
  state = {
    resizing: false,
    resizeStart: {},
    width: undefined,
    height: undefined,
    minWidth: undefined,
    minHeight: undefined,
    initialScreenX: undefined,
    initialScreenY: undefined,
  };

  render() {
    const { 
      children, 
      style={}, 
      hideHandle=false,
    } = this.props;
    const resizeableStyle = hideHandle ? {} : t.resizable;
    return (
      <div
        style={
          s({ 
              minWidth: 100,
              minHeight: 50,
              overflow: 'auto', 
              ...style 
            },
            resizeableStyle,
          )
        }
      >
        { children }
      </div>
    );
  }
}