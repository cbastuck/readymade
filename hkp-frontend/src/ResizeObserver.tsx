import { useEffect, useRef, useState } from "react";

import ResizeObserver from "resize-observer-polyfill";
import { AppViewMode } from "./types";

type Props = {
  onChange: (newState: OnChangeEvent) => void;
};

export type OnChangeEvent = {
  viewportWidth: number;
  appViewMode: AppViewMode;
};

export default function ResizeObserverComponent({ onChange }: Props) {
  const [viewportWidth, setViewportWidth] = useState<number | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const viewportWidthRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onResizeEvent = (entries: ResizeObserverEntry[]) => {
      const entry = entries && entries[0];
      if (entry) {
        const { width: newViewportWidth } = entry.contentRect;
        if (newViewportWidth !== viewportWidthRef.current) {
          const newState: OnChangeEvent = {
            viewportWidth: newViewportWidth,
            appViewMode: newViewportWidth > 400 ? "wide" : "narrow",
          };
          viewportWidthRef.current = newViewportWidth;
          setViewportWidth(newViewportWidth);
          onChange(newState);
        }
      }
    };

    resizeObserverRef.current = new ResizeObserver(onResizeEvent);
    resizeObserverRef.current.observe(document.body);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [onChange]);

  // suppress unused warning
  void viewportWidth;

  return <div />;
}
