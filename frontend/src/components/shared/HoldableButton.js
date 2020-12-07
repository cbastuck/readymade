import React, { Component } from 'react';

const isTouch = 'ontouchstart' in window;

export default class HoldableButton extends Component {
  onDown = ev => {
    const { onDown } = this.props;
    ev.stopPropagation();
    onDown();
  }

  onUp = ev => {
    const { onUp } = this.props;
    ev.stopPropagation();
    onUp();
  }

  onRightClick = ev => {
    const { onRightClick = () => {} } = this.props;
    ev.preventDefault();
    ev.stopPropagation();
    onRightClick();
  }

  render() {
    const { style, children } = this.props;
    return (
      <div
        style={style}
        onTouchStart={isTouch ? this.onDown : undefined}
        onTouchEnd={isTouch ? this.onUp : undefined}
        onTouchCancel={isTouch ? this.onUp : undefined}
        onMouseDown={!isTouch ? this.onDown : undefined}
        onMouseUp={!isTouch ? this.onUp : undefined}
        onMouseLeave={!isTouch ? this.onUp : undefined}
        onContextMenu={this.onRightClick}
      >
      { children ? children : false }
      </div>
    )
  }
}