import { useTheme } from "@/ui-components/ThemeContext";
import { Button as ButtonCN, ButtonProps } from "./primitives/button";
import { ReactElement } from "react";

type Props = ButtonProps & {
  icon?: ReactElement;
};
export default function Button(props: Props) {
  const theme = useTheme();
  return (
    <ButtonCN
      variant="outline"
      {...props}
      style={{
        backgroundColor: theme.buttonBackgroundColor,
      }}
    >
      {props.icon ? props.icon : props.children}
    </ButtonCN>
  );
}
