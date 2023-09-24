import { Dropdown } from "semantic-ui-react";
import { Link } from "react-router-dom";

import { s, t } from "../../styles";

type Props = {
  currentUser: string;
  onAction: (action: any) => void;
};

export default function ({ currentUser, onAction }: Props) {
  const fontStyle = s(t.uc, t.ls1, t.fs11);
  return currentUser ? (
    <Dropdown.Item
      onClick={() =>
        onAction({
          type: "logout",
        })
      }
    >
      <span style={fontStyle}>Logout</span>
    </Dropdown.Item>
  ) : (
    <Link to="/new">
      <Dropdown.Item>
        <span style={fontStyle}>Login</span>
      </Dropdown.Item>
    </Link>
  );
}
