// import { useTheme } from "@/ui-components/ThemeContext";
import { Button as ButtonCN, ButtonProps } from "./primitives/button";
import { ReactElement } from "react";

type Props = ButtonProps & {
  icon?: ReactElement;
};
export default function Button(props: Props) {
  // const theme = useTheme();
  return (
    <ButtonCN
      variant="outline"
      //style={{
      //  backgroundColor: theme.buttonBackgroundColor,
      //}}
      {...props}
    >
      {props.icon ? props.icon : props.children}
    </ButtonCN>
  );
}
