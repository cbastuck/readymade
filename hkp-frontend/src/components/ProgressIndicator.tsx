import { Component } from "react";

import "./ProgressIndicator.css";

type Props = {
  durationInSec: number;
  visible: boolean;
};

type State = {
  visible: boolean;
  animationStyle: {
    animation: string;
  };
};

export default class ProgressIndicator extends Component<Props, State> {
  state = {
    animationStyle: {
      animation: "",
    },
    visible: false,
  };

  triggerAnimation = () => {
    const { durationInSec } = this.props;
    const setAnimation = () =>
      setTimeout(
        () =>
          this.setState({
            animationStyle: {
              animation: `progress ${durationInSec}s ease-out forwards`,
            },
          }),
        1
      );
    this.setState({ animationStyle: { animation: "" } }, setAnimation);
  };

  componentDidUpdate(prevProps: Props) {
    const { visible } = this.props;
    if (prevProps.visible !== visible) {
      this.setState({ visible });
    }
  }

  render() {
    const { visible } = this.props;
    return (
      <div
        className={`flex-wrapper ${
          visible ? "fade-visible" : "fade-invisible"
        }`}
      >
        <div className="single-chart">
          <svg viewBox="0 0 36 36" className="circular-chart blue">
            <path
              className="circle-bg"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              id="progress-status-bar"
              style={this.state.animationStyle}
              className="circle"
              strokeDasharray="100, 100"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
        </div>
      </div>
    );
  }
}
