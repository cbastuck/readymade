import React, { useEffect, useRef, useState } from "react";

const tooltipTriggerTimeoutMsec = 1000;

type Props = {
  text: React.ReactNode;
  children?: React.ReactNode;
  width?: string | number;
};

export default function Tooltip({ text, children, width = "100%" }: Props): JSX.Element {
  const [visible, setVisible] = useState(false);
  const scheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scheduledTimerRef.current) {
        clearTimeout(scheduledTimerRef.current);
        scheduledTimerRef.current = null;
      }
    };
  }, []);

  const showTooltip = (): void => {
    if (!scheduledTimerRef.current) {
      scheduledTimerRef.current = setTimeout(() => {
        if (scheduledTimerRef.current) {
          scheduledTimerRef.current = null;
          setVisible(true);
        }
      }, tooltipTriggerTimeoutMsec);
    }
  };

  const clearTimer = (): void => {
    if (scheduledTimerRef.current) {
      clearTimeout(scheduledTimerRef.current);
      scheduledTimerRef.current = null;
    }
  };

  const hideTooltip = (): void => {
    clearTimer();
    setVisible(false);
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
      }}
      onMouseOver={showTooltip}
      onMouseLeave={hideTooltip}
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
