import { Dropdown } from "semantic-ui-react";
import { useAuth0 } from "@auth0/auth0-react";

import { s, t } from "../../styles";

import { AppCtx } from "../../AppContext";
import { useContext } from "react";
import { User } from "../../types";

type Props = {
  currentUser: User | null;
};

export default function AuthEntries({ currentUser }: Props) {
  const fontStyle = s(t.uc, t.ls1, t.fs11);
  const { loginWithRedirect, logout } = useAuth0();
  const context = useContext(AppCtx);
  return (
    <>
      <Dropdown.Item
        onClick={async () =>
          await loginWithRedirect({
            appState: {
              returnTo: window.location.href,
            },
          })
        }
      >
        <span style={fontStyle}>Login</span>
      </Dropdown.Item>
      <Dropdown.Item
        onClick={async () => {
          await logout({
            openUrl: () => {
              if (context) {
                context.logout();
              }
            },
          });
        }}
        disabled={!currentUser}
      >
        <span style={fontStyle}>Logout</span>
      </Dropdown.Item>
    </>
  );
}
