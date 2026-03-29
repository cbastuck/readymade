import { useState } from "react";

import "./ProgressIndicator.css";

type Props = {
  durationInSec: number;
  visible: boolean;
};

export default function ProgressIndicator({ durationInSec: _durationInSec, visible }: Props) {
  const [animationStyle] = useState({ animation: "" });

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
            style={animationStyle}
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
