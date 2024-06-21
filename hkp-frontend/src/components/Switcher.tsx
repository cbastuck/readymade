import { CSSProperties, Component } from "react";
import anime from "@/anime";

const defaultStyle = {
  fontSize: 45,
  letterSpacing: 1,
  marginBottom: 50,
};

type Props = {
  animate?: boolean;
  duration?: number;
  data: Array<string>;
  style?: CSSProperties;
  links?: Array<string>;
  onLink?: (idx: number) => void;
};

type State = { counter: number };

export default class Switcher extends Component<Props, State> {
  state: State = {
    counter: 0,
  };

  componentDidMount() {
    const { animate = false, duration = 5000 } = this.props;
    if (animate) {
      const animStepDuration = Math.floor(duration / 10);
      const triggerAnimation = () =>
        anime({
          targets: document.querySelectorAll("#switcher-item"),
          loop: false,
          direction: "forward",
          opacity: 1,
          easing: "easeInOutSine",
          duration: animStepDuration,
          complete: () =>
            anime({
              targets: document.querySelectorAll("#switcher-item"),
              loop: false,
              direction: "forward",
              opacity: 0,
              easing: "easeInOutSine",
              duration: animStepDuration,
              delay: duration - animStepDuration,
              complete: () => {
                this.setState(
                  { counter: this.state.counter + 1 },
                  triggerAnimation
                );
              },
            }),
        });
      triggerAnimation();
    }
  }

  render() {
    const { data, links, style = defaultStyle, onLink } = this.props;
    const idx = this.state.counter % data.length;

    return links ? (
      <a
        id="switcher-item"
        style={{ ...style }}
        href={links[idx]}
        onClick={() => onLink?.(idx)}
      >
        {data[idx]}
      </a>
    ) : (
      <span id="switcher-item" style={{ ...style }}>
        {data[idx]}
      </span>
    );
  }
}
