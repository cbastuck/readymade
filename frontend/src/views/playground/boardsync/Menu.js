import React from "react";
import { Dropdown } from "semantic-ui-react";

import ManageSync from "./ManageSync";

const menuItemStyle = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const mainEntry = "Board Sync";

export default function Menu({ actions, onChange, value }) {
  return (
    <Dropdown
      text={value ? value.name : mainEntry}
      style={{
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        backgroundColor: "#E8E8E8",
        borderRadius: 5,
        padding: "6px 10px",
        color: "#5c5d5c",
        border: "solid 1ox gray",
        whiteSpace: "nowrap",
      }}
    >
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => onChange(undefined)}>
          <span style={menuItemStyle}>{mainEntry}</span>
        </Dropdown.Item>

        <Dropdown.Item
          onClick={() =>
            onChange({
              element: <ManageSync {...actions} />,
              name: "Manage Sync",
            })
          }
        >
          <span style={menuItemStyle}>Manage Sync</span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
