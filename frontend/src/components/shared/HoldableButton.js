import React, { Component } from 'react';

export default class HoldableButton extends Component {
  ComponentDidMount() {
    this.isTouch = 'ontouchstart' in window;
  }

  render() {
    const { style, onDown, onUp } = this.props;
    return (
      <div
        style={style}
        onTouchStart={this.isTouch ? onDown : undefined}
        onTouchEnd={this.isTouch ? onUp : undefined}
        onTouchCancel={this.isTouch ? onUp : undefined}
        onMouseDown={!this.isTouch ? onDown : undefined}
        onMouseUp={!this.isTouch ? onUp : undefined}
        onMouseLeave={!this.isTouch ? onUp : undefined}
      />
    )
  }
}