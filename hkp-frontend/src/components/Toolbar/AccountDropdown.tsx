import { Dropdown, Icon } from "semantic-ui-react";

import Login from "./Login";
import { s, t } from "../../styles";

type Props = {
  currentUser: string;
  onAction: (action: any) => void;
};
export default function AccountDropdown({ currentUser = "", onAction }: Props) {
  const icon = (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
      }}
    >
      <Icon name="user" style={{ margin: "0px 5px" }} />
      <div style={s(t.uc, t.fs10, t.ls1, t.mt1)}>{currentUser}</div>
    </div>
  );
  return (
    <div style={{ marginLeft: "auto" }}>
      <Dropdown icon={icon} className="link item right">
        <Dropdown.Menu>
          <Login currentUser={currentUser} onAction={onAction} />
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
