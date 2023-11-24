import { Link } from "react-router-dom";

import CompactNav from "./CompactNav";
import { AppContextState } from "../../AppContext";

type Props = {
  appContext: AppContextState | null;
  isCompact: boolean;
};

export default function Navigation({ isCompact }: Props) {
  const navItemStyle: any = {
    margin: 8,
    fontSize: 11,
    textTransform: "uppercase",
  };
  return (
    <div
      style={{
        marginTop: 10,
        width: "100%",
        textAlign: "right",
        marginRight: 10,
      }}
    >
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
      {!isCompact && (
        <Link to="/playground" style={navItemStyle}>
          Playground
        </Link>
      )}
    </div>
  );
}
