import React, { Component } from "react";

import "./HoldableButton.css";

const isTouch = "ontouchstart" in window;

export default class HoldableButton extends Component {
  state = {
    isDown: false,
  };

  onDown = (ev) => {
    const { onDown } = this.props;
    ev.stopPropagation();
    this.setState({ isDown: true });
    onDown();
  };

  onUp = (ev) => {
    const { onUp } = this.props;
    if (this.state.isDown) {
      ev.stopPropagation();
      onUp();
      this.setState({ isDown: false });
    }
  };

  onRightClick = (ev) => {
    const { onRightClick = () => {} } = this.props;
    ev.preventDefault();
    ev.stopPropagation();
    this.setState({ isDown: true });
    onRightClick();
  };

  render() {
    const { style, children } = this.props;
    return (
      <button
        className="holdable-button hkp-fnt-family"
        style={{ ...style, touchAction: "none" }} // manipulation if pan and two finger gestures should be allowed
        onTouchStart={isTouch ? this.onDown : undefined}
        onTouchEnd={isTouch ? this.onUp : undefined}
        onTouchCancel={isTouch ? this.onUp : undefined}
        onMouseDown={!isTouch ? this.onDown : undefined}
        onMouseUp={!isTouch ? this.onUp : undefined}
        onMouseLeave={!isTouch ? this.onUp : undefined}
        onContextMenu={
          !isTouch
            ? this.onRightClick
            : (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
              }
        }
      >
        {children ? children : false}
      </button>
    );
  }
}
