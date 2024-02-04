import { Dropdown, Icon } from "semantic-ui-react";

import AuthEntries from "./AuthEntries";
import { s, t } from "../../styles";
import { User } from "../../types";
import { redirectTo } from "../../core/actions";

type Props = {
  currentUser: User | null;
};
export default function AccountDropdown({ currentUser }: Props) {
  const fontStyle = s(t.ls1, t.fs11);
  const icon = (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
      }}
    >
      <Icon name="user" style={{ margin: "0px 5px" }} />
      <div
        style={s(t.ls1, t.mt1, {
          fontSize: 12,
          paddingTop: 2,
          maxWidth: "40px",
          overflowX: "hidden",
          textOverflow: "ellipsis",
        })}
      >
        {currentUser?.username}
      </div>
    </div>
  );
  return (
    <div style={{ marginLeft: "auto" }}>
      <Dropdown icon={icon} className="link item right hkp-fnt-label">
        <Dropdown.Menu>
          <AuthEntries currentUser={currentUser} />
          <Dropdown.Divider />
          <Dropdown.Item
            onClick={() => redirectTo("/profile")}
            disabled={!currentUser}
          >
            <span style={fontStyle}>Profile</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
