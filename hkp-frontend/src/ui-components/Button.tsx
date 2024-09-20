// import { useTheme } from "@/ui-components/ThemeContext";
import { Button as ButtonCN, ButtonProps } from "./primitives/button";
import { ReactElement, useMemo } from "react";
import { TooltipProvider } from "./primitives/tooltip";
import Tooltip, { TooltipContent } from "./Tooltip";

type Props = ButtonProps & {
  icon?: ReactElement;
  tooltip?: TooltipContent;
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
    <TooltipProvider>
      <Tooltip value={tooltip}>{buttonComponent}</Tooltip>
    </TooltipProvider>
  ) : (
    buttonComponent
  );
}
