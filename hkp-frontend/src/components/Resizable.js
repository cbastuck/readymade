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

  onResize = debounce((ev) => {
    if (this.props.onResize) {
      this.props.onResize(ev[0].contentRect);
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
            minWidth: 200,
            minHeight: 100,
            overflow: "auto",
            ...style,
          },
          resizeableStyle
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
