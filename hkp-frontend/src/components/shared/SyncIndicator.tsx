import React, { Component, CSSProperties } from "react";

import Tooltip from "./Tooltip";
import { labelWidth, labelHeight } from "./Defaults";

type Props = {
  style: CSSProperties;
  inSync: boolean;
  label: string;
  onClick: (ev: React.MouseEvent<HTMLElement>) => void;
};
export default class SyncIndicator extends Component<Props> {
  render() {
    const { style, inSync, label, onClick } = this.props;
    return typeof label === "string" ? (
      <div style={{ width: "auto" }}>
        <Tooltip text={label}>
          <div
            style={{
              backgroundColor: "#E8E8E8",
              border: "1px solid rgb(186, 186, 186)",
              borderRadius: 2,
              letterSpacing: 1,
              textAlign: "center",
              paddingTop: 10,
              minWidth: labelWidth,
              minHeight: labelHeight,
              color: !inSync ? "red" : undefined,
              cursor: !inSync ? "pointer" : undefined,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              ...style,
            }}
            onClick={onClick}
          >
            {label}
          </div>
        </Tooltip>
      </div>
    ) : (
      label
    );
  }
}
