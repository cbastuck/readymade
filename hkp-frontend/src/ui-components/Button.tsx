// import { useTheme } from "@/ui-components/ThemeContext";
import { Button as ButtonCN, ButtonProps } from "./primitives/button";
import { ReactElement } from "react";

type Props = ButtonProps & {
  icon?: ReactElement;
};
export default function Button(props: Props) {
  // const theme = useTheme();
  const { className, ...rest } = props;
  return (
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
  );
}
