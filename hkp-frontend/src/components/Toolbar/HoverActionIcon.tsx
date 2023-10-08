import { Icon, SemanticICONS } from "semantic-ui-react";

import "./HoverActionIcon.css";

type Props = {
  iconName: SemanticICONS;
  tooltip?: string;
  dangerous?: boolean;
  disabled?: boolean;

  onClick: (iconName: SemanticICONS) => void;
};

export default function HoverActionIcon({
  iconName,
  dangerous,
  disabled,
  tooltip,
  onClick,
}: Props) {
  const styleClass = disabled
    ? "hover-icon-dark-disabled"
    : dangerous
    ? "hover-icon-dark-dangerous"
    : "hover-icon-dark";
  return (
    <div className={styleClass} title={tooltip}>
      <Icon
        name={iconName}
        onClick={() => onClick(iconName)}
        disabled={disabled}
      />
    </div>
  );
}
