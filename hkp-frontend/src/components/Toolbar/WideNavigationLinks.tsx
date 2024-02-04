import { CSSProperties } from "react";
import { Link } from "react-router-dom";

export default function NavigationLinks() {
  const navItemStyle: CSSProperties = {
    margin: 8,
    fontSize: 11,
    textTransform: "uppercase",
  };
  return (
    <>
      <Link to="/docs" style={navItemStyle}>
        Docs
      </Link>

      <Link to="/examples" style={navItemStyle}>
        Examples
      </Link>

      <Link to="/playground" style={navItemStyle}>
        Playground
      </Link>
    </>
  );
}
