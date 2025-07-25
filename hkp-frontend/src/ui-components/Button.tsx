// import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";
import { Button as ButtonCN, ButtonProps } from "./primitives/button";
import { ReactElement, useMemo } from "react";

import Tooltip, { TooltipContentType } from "./Tooltip";

type Props = ButtonProps & {
  icon?: ReactElement;
  tooltip?: TooltipContentType;
};
export default function Button(props: Props) {
  // const theme = useTheme();
  const { className, tooltip, ...rest } = props;

  const buttonComponent = useMemo(
    () => (
      <ButtonCN
        variant="outline"
        //style={{
        //  backgroundColor: theme.buttonBackgroundColor,
        //}}
        className={`text-base tracking-widest ${className}`}
        {...rest}
      >
        {props.icon ? props.icon : props.children}
      </ButtonCN>
    ),
    [props, className, rest]
  );

  return tooltip ? (
    <Tooltip value={tooltip}>{buttonComponent}</Tooltip>
  ) : (
    buttonComponent
  );
}
