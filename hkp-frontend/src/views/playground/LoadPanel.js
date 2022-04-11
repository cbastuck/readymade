import React from "react";

import { Tab } from "semantic-ui-react";

import Usecases from "./Usecases";
import StoredBoards from "./StoredBoards";
import { localStoragePrefix } from "./common";
import { s, t } from "../../styles";

export default function LoadPanel({ children, showSaveReminder }) {
  const menuItem = (value) => ({
    key: `playgound-tab-item-${value}`,
    content: value,
    style: s(t.uc, t.fs12, t.ls1),
  });

  return (
    <Tab
      style={s(t.m(0, 30), t.tc)}
      menu={{ attached: "top", widths: 2, pointing: true }}
      panes={[
        {
          menuItem: menuItem("Launch Usecase"),
          render: () => (
            <Tab.Pane>
              <Usecases />
            </Tab.Pane>
          ),
        },
        {
          menuItem: menuItem("Restore board"),
          render: () => (
            <Tab.Pane>
              <StoredBoards prefix={localStoragePrefix} />
            </Tab.Pane>
          ),
        },
      ]}
      defaultActiveIndex={0}
    />
  );
}
