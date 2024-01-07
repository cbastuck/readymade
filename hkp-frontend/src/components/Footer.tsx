import { Link } from "react-router-dom";

import build from "../buildNumber.json";

import "./Footer.css";

type Props = {
  flex?: boolean;
};
export default function Footer({ flex }: Props) {
  const fontStyle: any = {
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 11,
  };
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
              color: "#555",
              fontSize: 10,
            }}
          >
            © 2018-2024 cbastuck -
            <span style={{ color: "gray", padding: 5, textTransform: "none" }}>
              v{build.version}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
