import { Component } from "react";

import ResizeObserver from "resize-observer-polyfill";
import { AppViewMode } from "./types";

type Props = {
  onChange: (newState: OnChangeEvent) => void;
};

type State = {
  viewportWidth: number | undefined;
};

export type OnChangeEvent = {
  viewportWidth: number;
  appViewMode: AppViewMode;
};

export default class ResizeObserverComponent extends Component<Props, State> {
  state = {
    viewportWidth: undefined,
  };
  resizeObserver: ResizeObserver | null = null;

  componentDidMount() {
    this.resizeObserver = new ResizeObserver(this.onResizeEvent);
    this.resizeObserver.observe(document.body);
  }

  componentWillUnmount() {
    this.resizeObserver?.disconnect();
  }

  onResizeEvent = (entries: ResizeObserverEntry[]) => {
    const { viewportWidth } = this.state;
    const { onChange } = this.props;
    const entry = entries && entries[0];
    if (entry) {
      const { width: newViewportWidth } = entry.contentRect;
      if (newViewportWidth !== viewportWidth) {
        const newState: OnChangeEvent = {
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
