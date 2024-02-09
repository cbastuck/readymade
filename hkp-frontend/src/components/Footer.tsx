import { CSSProperties, useContext } from "react";
import { Link } from "react-router-dom";

import build from "../buildNumber.json";

import "./Footer.css";
import { AppCtx } from "../AppContext";

type Props = {
  flex?: boolean;
};

export default function Footer({ flex }: Props) {
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
          <Link to="/about"> about </Link>
          {" ‧ "}
          <Link to="/imprint"> imprint </Link>
          {" ‧ "}
          <Link to="/contact"> contact </Link>
          <div
            style={{
              marginLeft: "auto",
              marginRight: 10,
              fontSize: 10,
            }}
          >
            {isWide ? (
              <span style={{ fontFamily: "Roboto" }}>
                "© 2018-2024 cbastuck - "
              </span>
            ) : (
              "©2018-2024"
            )}

            <span
              style={{
                color: "gray",
                padding: 5,
                textTransform: "none",
                fontSize: isWide ? undefined : "9px",
              }}
            >
              v{build.version}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
