import React from "react";

import { Tab } from "semantic-ui-react";

import Usecases from "./Usecases";
import StoredBoards from "./StoredBoards";
import { localStoragePrefix } from "./common";
import { s, t } from "../../styles";

export default function LoadPanel({
  children,
  showSaveReminder,
  initialTabLocation,
}) {
  const menuItem = (value) => ({
    key: `playgound-tab-item-${value}`,
    content: value,
    style: s(t.uc, t.fs12, t.ls1),
  });
  const saveReminder = showSaveReminder && (
    <div style={s(t.fs12, t.mb10)}>
      Remember you can
      <span
        style={{ cursor: "help", color: "#4284C4" }}
        onClick={() => {
          const selector = document.getElementById("board-dropdown");
          if (selector) {
            selector.focus();
            selector.click();
          }
        }}
      >
        {" save this board "}
      </span>
      to continue later
    </div>
  );
  const initialIndex = initialTabLocation === "#usecase" ? 1 : 0;
  return (
    <div style={s(t.uc, t.fs16, t.ls1, t.tc)}>
      <h1
        style={s(t.fs20, {
          margin: 0,
          marginTop: 25,
        })}
      >
        Welcome to Playground
      </h1>
      <h2 style={s(t.fs13, t.m(0, 10))}> Pick an option </h2>
      <Tab
        style={s(t.m(0, 30), t.tc)}
        menu={{ attached: "top", widths: 3, pointing: true }}
        panes={[
          {
            menuItem: menuItem("Sketch board"),
            render: () => (
              <Tab.Pane>
                {children} {saveReminder}
              </Tab.Pane>
            ),
          },
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
        defaultActiveIndex={initialIndex}
      />
    </div>
  );
}
