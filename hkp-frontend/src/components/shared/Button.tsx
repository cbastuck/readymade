import { CSSProperties } from "react";
import { Button, SemanticSIZES } from "semantic-ui-react";

type Props = {
  className?: string;
  children?: JSX.Element | string | undefined;
  style?: CSSProperties;
  disabled?: boolean;
  icon?: string;
  size?: SemanticSIZES;
  type?: "submit" | "reset" | "button";
  onClick?: () => void;
};

export default function ButtonComponent({
  className,
  children = undefined,
  style = {},
  disabled = false,
  icon,
  size,
  type,
  onClick,
}: Props) {
  const buttonStyle = {
    fontSize: 12,
    letterSpacing: 1,

    backgroundColor: "#efefef",
    border: "solid 1px #bababa",
    ...style,
  };

  return (
    <Button
      style={buttonStyle}
      className={className ? className : "hkp-button"}
      disabled={disabled}
      icon={icon}
      size={size}
      type={type}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
