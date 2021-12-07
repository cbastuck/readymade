import React, { Component } from "react";

import ResizeObserver from "resize-observer-polyfill";

export default class ResizeObserverComponent extends Component {
  state = {
    viewportWidth: undefined,
  };

  componentDidMount() {
    this.resizeObserver = new ResizeObserver(this.onResizeEvent);
    this.resizeObserver.observe(document.body);
  }

  componentWillUnmount() {
    this.resizeObserver.disconnect();
  }

  onResizeEvent = (entries) => {
    const { viewportWidth } = this.state;
    const { onChange } = this.props;
    const entry = entries && entries[0];
    if (entry) {
      const { width: newViewportWidth } = entry.contentRect;
      if (newViewportWidth !== viewportWidth) {
        const newState = {
          viewportWidth: newViewportWidth,
          appViewMode: newViewportWidth > 400 ? "wide" : "narrow",
        };
        this.setState(newState);
        onChange(newState);
      }
    }
  };

  render() {
    return <div />;
  }
}
