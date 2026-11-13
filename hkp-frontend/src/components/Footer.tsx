import { CSSProperties, useContext } from "react";

import "./Footer.css";
import { AppCtx } from "../AppContext";
import Copyright from "./Copyright";

type Props = {
  /**
   * A row at the end of a flex column, taking its own height, rather than a
   * strip fixed over the bottom of the window. In the flow nothing has to
   * guess its height to keep clear of it.
   */
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
        flexShrink: flex ? 0 : undefined,
        width: "100%",
        bottom: !flex ? 0 : undefined,
        left: !flex ? 0 : undefined,
        zIndex: 2,
      }}
    >
      <div
        style={{
          ...fontStyle,
          // At the bottom of the screen in the flow, so it is what keeps
          // clear of the home indicator.
          paddingBottom: flex ? "env(safe-area-inset-bottom, 0px)" : undefined,
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
          <Copyright isWide={isWide} />
        </div>
      </div>
    </div>
  );
}
