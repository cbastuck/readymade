import { Icon } from "semantic-ui-react";

import { s, t } from "../../../styles";

export default function Configuration() {
  return (
    <div style={s(t.tc, { marginTop: 20 })}>
      <Icon name="file outline" size="big" />
      <div style={s(t.fs11, t.ls1, t.mt5, { color: "#333" })}>
        Configuration
      </div>
    </div>
  );
}
