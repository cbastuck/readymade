import { CSSProperties } from "react";
import { Link } from "react-router-dom";

export default function NavigationLinks() {
  const navItemStyle: CSSProperties = {
    margin: 8,
    fontSize: 12,
    letterSpacing: 1.5,
  };
  return (
    <div className="hkp-fnt-family" style={{ marginTop: 2 }}>
      <Link to="/docs" style={navItemStyle}>
        Docs
      </Link>

      <Link to="/examples" style={navItemStyle}>
        Examples
      </Link>

      <Link to="/playground" style={navItemStyle}>
        Playground
      </Link>
    </div>
  );
}
