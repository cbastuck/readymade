import { CSSProperties } from "react";
import { Link } from "react-router-dom";

export default function NavigationLinks() {
  const navItemStyle: CSSProperties = {
    margin: 8,
    fontSize: 11,
    letterSpacing: 1.5,
  };
  return (
    <>
      <Link to="/docs" className="hkp-fnt-p" style={navItemStyle}>
        Docs
      </Link>

      <Link to="/examples" className="hkp-fnt-p" style={navItemStyle}>
        Examples
      </Link>

      <Link to="/playground" className="hkp-fnt-p" style={navItemStyle}>
        Playground
      </Link>
    </>
  );
}
