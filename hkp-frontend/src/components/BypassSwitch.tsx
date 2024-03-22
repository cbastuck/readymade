import { Icon } from "semantic-ui-react";

import { t } from "../styles";
import { CSSProperties } from "react";

type Props = {
  bypass: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  onChange: (bypass: boolean) => void;
};

export default function BypassSwitch({
  bypass,
  disabled,
  style,
  onChange,
}: Props) {
  const defaultStyle = t.p(15, 13);
  return (
    <div style={style || defaultStyle}>
      {disabled ? (
        <div style={{ width: 16 }} />
      ) : (
        <Icon
          style={{
            cursor: "pointer",
            opacity: 0.5,
          }}
          name="power off"
          color={bypass ? "red" : "grey"}
          onClick={(ev: React.MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
            onChange(!bypass);
          }}
        />
      )}
    </div>
  );
}
