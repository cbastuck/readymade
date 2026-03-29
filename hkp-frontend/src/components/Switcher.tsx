import { CSSProperties, useEffect, useRef, useState } from "react";
import anime from "hkp-frontend/src/anime";

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
  suffix?: string;
  onLink?: (idx: number) => void;
};

export default function Switcher({
  animate = false,
  duration = 5000,
  data,
  style = defaultStyle,
  suffix,
  onLink,
}: Props) {
  const [counter, setCounter] = useState(0);
  const counterRef = useRef(0);

  useEffect(() => {
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
                counterRef.current = counterRef.current + 1;
                setCounter(counterRef.current);
                triggerAnimation();
              },
            }),
        });
      triggerAnimation();
    }
  }, [animate, duration]);

  const idx = counter % data.length;

  return (
    <a
      id="switcher-item"
      style={{ ...style }}
      href={"#samples"}
      onClick={() => onLink?.(idx)}
    >
      {data[idx]}
      {suffix || ""}
    </a>
  );
}
