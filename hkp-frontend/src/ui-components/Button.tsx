// import { useTheme } from "@/ui-components/ThemeContext";
import { Button as ButtonCN, ButtonProps } from "./primitives/button";
import { ReactElement, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./primitives/tooltip";

type Props = ButtonProps & {
  icon?: ReactElement;
  tooltip?: string;
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
      <Tooltip>
        <TooltipTrigger asChild>{buttonComponent}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    buttonComponent
  );
}
