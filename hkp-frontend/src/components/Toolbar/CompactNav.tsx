import { Dropdown } from "semantic-ui-react";
import { Link } from "react-router-dom";

export default function CompactNav() {
  const navItemStyle: any = {
    margin: 8,
    fontSize: 11,
    textTransform: "uppercase",
  };
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

          <Dropdown.Item>
            <Link to="/new" style={navItemStyle}>
              Login
            </Link>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
