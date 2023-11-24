import React, { Component } from "react";
import { Label } from "semantic-ui-react";

import Tooltip from "./Tooltip";
import { labelWidth, labelHeight } from "./Defaults";

type Props = {
  style: any;
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
          <Label
            style={{
              backgroundColor: "#E8E8E8",
              borderRadius: 2,
              textTransform: "uppercase",
              letterSpacing: 1,
              textAlign: "center",
              paddingTop: 10,
              minWidth: labelWidth,
              minHeight: labelHeight,
              color: !inSync && "red",
              cursor: !inSync ? "pointer" : undefined,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              ...style,
            }}
            onClick={onClick}
          >
            {label}
          </Label>
        </Tooltip>
      </div>
    ) : (
      label
    );
  }
}
