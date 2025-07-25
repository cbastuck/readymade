import {
  CSSProperties,
  MouseEvent,
  ReactElement,
  TouchEvent,
  useState,
} from "react";
import "./HoldableButton.css";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
const isTouch = "ontouchstart" in window;

type Props = {
  children?: ReactElement | string;
  style?: CSSProperties;
  onUp: () => void;
  onDown: () => void;
  onRightClick?: (ev: MouseEvent) => void;
};

export default function HoldableButton({
  style = {},
  children,
  onDown: onDownProp,
  onUp: onUpProp,
  onRightClick: onRightClickProp,
}: Props) {
  const [isDown, setIsDown] = useState(false);

  const onDown = (ev: MouseEvent | TouchEvent) => {
    ev.stopPropagation();
    setIsDown(true);
    onDownProp();
  };

  const onUp = (ev: MouseEvent | TouchEvent) => {
    if (isDown) {
      ev.stopPropagation();
      onUpProp();
      setIsDown(false);
    }
  };

  const onRightClick = (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDown(true);
    onRightClickProp?.(ev);
  };

  return (
    <Button
      variant="outline"
      style={{ ...style, touchAction: "none" }} // manipulation if pan and two finger gestures should be allowed
      onTouchStart={isTouch ? onDown : undefined}
      onTouchEnd={isTouch ? onUp : undefined}
      onTouchCancel={isTouch ? onUp : undefined}
      onMouseDown={!isTouch ? onDown : undefined}
      onMouseUp={!isTouch ? onUp : undefined}
      onMouseLeave={!isTouch ? onUp : undefined}
      onContextMenu={
        !isTouch
          ? onRightClick
          : (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
            }
      }
    >
      {children ? children : false}
    </Button>
  );
}
