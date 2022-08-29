import React, { useEffect, useState } from "react";

import { Tab } from "semantic-ui-react";

import { localStoragePrefix, getLocalBoards } from "./common";
import { s, t } from "../../styles";
import BoardCollection from "../../components/BoardCollection";

export default function LoadPanel() {
  const [items, setSavedBoards] = useState([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  const menuItem = (value) => ({
    key: `playgound-tab-item-${value}`,
    content: value,
    style: s(t.uc, t.fs12, t.ls1),
  });

  return (
    <Tab
      style={s(t.m(0, 20), t.tc)}
      menu={{ attached: "top", widths: 2, pointing: true }}
      panes={[
        {
          menuItem: menuItem("Restore a board"),
          render: () => (
            <Tab.Pane>
              <SavedBoards items={items} />
            </Tab.Pane>
          ),
        },
      ]}
      defaultActiveIndex={0}
    />
  );
}

function SavedBoards({ items }) {
  return (
    <div style={s(t.mt20, t.uc)}>
      <BoardCollection
        style={{ width: "100%", marginRight: 20 }}
        headline="Saved on this browser"
        items={items}
        renderBorder={false}
      />
    </div>
  );
}
