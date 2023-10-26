import React, { Component } from "react";

import { s, t } from "../styles";

export default class Resizable extends Component {
  componentDidMount() {
    this.resizableObserver = new ResizeObserver(this.onResize);
  }
  componentWillUnmount() {
    this.resetObserver();
  }

  resetObserver = () => {
    if (this.resizableObserver) {
      this.resizableObserver.disconnect();
    }
  };

  onResize = debounce((entries) => {
    if (this.props.onResize) {
      const { width, height } = entries[0].contentRect;
      const floorWidth = Math.floor(width);
      const floorHeight = Math.floor(height);
      if (floorWidth !== this.width || floorHeight !== this.height) {
        this.width = floorWidth;
        this.height = floorHeight;
        this.props.onResize({ width: floorWidth, height: floorHeight });
      }
    }
  }, 300);

  render() {
    const { children, style = {}, hideHandle = false } = this.props;
    const resizeableStyle = hideHandle ? {} : t.resizable;
    return (
      <div
        ref={(ref) => {
          this.resetObserver();
          if (ref && this.resizableObserver) {
            this.resizableObserver.observe(ref);
          }
        }}
        style={s(
          {
            overflow: "auto",
          },
          resizeableStyle,
          style
        )}
      >
        {children}
      </div>
    );
  }
}

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
