import { CSSProperties, useContext } from "react";
import { Link } from "react-router-dom";

import "./Footer.css";
import { AppCtx } from "../AppContext";
import Copyright from "./Copyright";

type Props = {
  flex?: boolean;
  isCompact?: boolean;
};

export default function Footer({ flex, isCompact }: Props) {
  const fontStyle: CSSProperties = {
    letterSpacing: 2,
    fontSize: 12,
  };

  const appContext = useContext(AppCtx);
  const isWide = appContext?.appViewMode === "wide";

  return (
    <div
      style={{
        position: !flex ? "fixed" : undefined,
        marginTop: flex ? "auto" : undefined,
        width: "100%",
        // height: flex ? 45 : 30,
        bottom: !flex ? 0 : undefined,
        left: !flex ? 0 : undefined,
        zIndex: 2,
      }}
    >
      <div
        style={{
          ...fontStyle,
          marginTop: flex ? 10 : undefined,
          marginBottom: flex ? 0 : undefined,
          borderTop: "1px solid rgba(34,36,38,.15)",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
        }}
      >
        <div
          style={{
            marginLeft: 10,
            paddingTop: 3,
            paddingBottom: 3,
            display: "flex",
            flexDirection: "row",
            gap: "5px",
          }}
        >
          {!isCompact && (
            <>
              <Link to="/about"> about </Link>
              {" ‧ "}
              <Link to="/terms"> terms </Link>
              {" ‧ "}
              <Link to="/privacy"> privacy </Link>
            </>
          )}

          <Copyright isWide={isWide} />
        </div>
      </div>
    </div>
  );
}
