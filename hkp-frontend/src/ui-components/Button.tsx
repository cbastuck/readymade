import {
  Button as ButtonCN,
  ButtonProps,
} from "@/ui-components/primitives/button";
import { ReactElement } from "react";

type Props = ButtonProps & {
  icon?: ReactElement;
};
export default function Button(props: Props) {
  return (
    <ButtonCN variant="outline" {...props}>
      {props.icon ? props.icon : props.children}
    </ButtonCN>
  );
}
