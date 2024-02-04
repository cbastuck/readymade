import { CSSProperties } from "react";
import { Button, SemanticSIZES } from "semantic-ui-react";

import "./Button.css";

type Props = {
  children?: JSX.Element | string | undefined;
  style?: CSSProperties;
  disabled?: boolean;
  icon?: string;
  size?: SemanticSIZES;
  onClick: () => void;
};

export default function ButtonComponent({
  children = undefined,
  style = {},
  disabled = false,
  icon,
  size,
  onClick,
}: Props) {
  const buttonStyle = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    width: "100%",
    backgroundColor: "#efefef",
    border: "solid 1px #bababa",
    ...style,
  };

  return (
    <Button
      style={buttonStyle}
      className="hkp-button"
      disabled={disabled}
      icon={icon}
      size={size}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
