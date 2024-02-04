import { Dropdown } from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useContext, CSSProperties } from "react";
import { AppCtx } from "../../AppContext";

export default function CompactNav() {
  const navItemStyle: CSSProperties = {
    margin: 8,
    fontSize: 11,
    textTransform: "uppercase",
  };
  const { loginWithRedirect, logout } = useAuth0();
  const context = useContext(AppCtx);
  const currentUser = context?.user;
  return (
    <div>
      <Dropdown text="" icon="bars" pointing="right">
        <Dropdown.Menu>
          <Dropdown.Item>
            <Link to="/docs" style={navItemStyle}>
              Docs
            </Link>
          </Dropdown.Item>
          <Dropdown.Item>
            <Link to="/examples" style={navItemStyle}>
              Examples
            </Link>
          </Dropdown.Item>
          <Dropdown.Item>
            <Link to="/playground" style={navItemStyle}>
              Playground
            </Link>
          </Dropdown.Item>

          <Dropdown.Item
            onClick={async () =>
              await loginWithRedirect({
                appState: {
                  returnTo: window.location.href,
                },
              })
            }
          >
            <span style={navItemStyle}>Login</span>
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
            <span style={navItemStyle}>Logout</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
