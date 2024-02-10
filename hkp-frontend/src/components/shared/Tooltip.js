import React, { Component } from "react";

const tooltipTriggerTimeoutMsec = 1000;

export default class Tooltip extends Component {
  state = {
    visible: false,
  };
  scheduledTimer = null;

  componentWillUnmount() {
    this.clearTimer();
  }

  showTooltip = () => {
    if (!this.scheduledTimer) {
      this.scheduledTimer = setTimeout(() => {
        if (this.scheduledTimer) {
          this.scheduledTimer = null;
          this.setState({ visible: true });
        }
      }, tooltipTriggerTimeoutMsec);
    }
  };

  clearTimer = () => {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
  };

  hideTooltip = () => {
    this.clearTimer();
    this.setState({ visible: false });
  };

  render() {
    const { text, children, width = "100%" } = this.props;
    const { visible } = this.state;
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          position: "relative",
        }}
        onMouseOver={this.showTooltip}
        onMouseLeave={this.hideTooltip}
      >
        {children}
        <span
          style={{
            visibility: visible ? "visible" : "hidden",
            backgroundColor: "white",
            color: "gray",
            textAlign: "center",
            borderRadius: 6,
            padding: "5px 0px",
            border: "solid 1px gray",
            position: "absolute",
            zIndex: 200001,
            top: 0,
            left: "50%",

            width,
          }}
        >
          {text}
        </span>
      </div>
    );
  }
}
