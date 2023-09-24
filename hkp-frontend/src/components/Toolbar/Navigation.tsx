import { Link } from "react-router-dom";

import CompactNav from "./CompactNav";

type Props = {
  appContext: any;
  isCompact: boolean;
};

export default function Navigation({ appContext, isCompact }: Props) {
  const navItemStyle: any = {
    margin: 8,
    fontSize: 11,
    textTransform: "uppercase",
  };
  const username = appContext && appContext.user && appContext.user.username;
  return (
    <div
      style={{
        marginTop: 10,
        width: "100%",
        textAlign: "right",
        marginRight: 10,
      }}
    >
      {/* <span style={navItemStyle}>Go to:</span> */}
      {username && (
        <Link to="/dashboard" style={navItemStyle}>
          {/*appContext.user.username*/}Home
        </Link>
      )}
      {isCompact && <CompactNav />}
      {!isCompact && (
        <Link to="/docs" style={navItemStyle}>
          Docs
        </Link>
      )}
      {!isCompact && (
        <Link to="/examples" style={navItemStyle}>
          Examples
        </Link>
      )}
      {!username && !isCompact && (
        <Link to="/playground" style={navItemStyle}>
          Playground
        </Link>
      )}
    </div>
  );
}
