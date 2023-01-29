import React, { Component } from "react";

import { s, t } from "../styles";

export default class Resizable extends Component {
  componentDidMount() {
    this.setState({
      width: undefined,
      height: undefined,
    });
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
      const { width, height } = ev[0].contentRect;
      if (width !== this.state.width || height !== this.state.height) {
        this.setState({ width, height }, () =>
          this.props.onResize({ width, height })
        );
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
            minWidth: 200,
            minHeight: 100,
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
