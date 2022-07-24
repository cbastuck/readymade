import React from "react";
import { Icon } from "semantic-ui-react";

import { s, t } from "../../styles";
import { ReactComponent as Logo } from "./hkp-dots-braid.svg";

export default function EmptySketch({ boardName }) {
  const headline = !boardName ? (
    "this is an empty board"
  ) : (
    <span style={s(t.tc, t.fs14, t.uc, t.ls1)}>
      Board <span style={t.italic}>{boardName}</span> is empty
    </span>
  );
  return (
    <div style={s(t.uc, { margin: headline && "15px 0px" })}>
      {headline && <div style={{ marginTop: 20 }}></div>}
      <div style={{ padding: headline && "20px 0px" }}>
        <div style={s(t.tc, t.mt0, t.mb30)}>
          {true ? (
            <div
              style={{
                border: "dashed 1px lightgray",
                padding: 20,
                width: "90%",
                margin: "auto",
                borderRadius: 5,
              }}
            >
              <h1 style={s(t.fs14, t.tc, t.m(0, 6))}> {headline} </h1>
              <div style={{ width: 120, margin: "30px auto" }}>
                <Logo />
              </div>
              <div style={s(t.uc, t.fs14, t.ls1, t.tc)}>
                <span
                  style={{ cursor: "help", color: "#4284C4" }}
                  onClick={() => {
                    const selector =
                      document.getElementById("runtime-dropdown");
                    if (selector) {
                      selector.focus();
                      selector.click();
                    }
                  }}
                >
                  {" add a runtime "}
                </span>
                to sketch an idea
              </div>
            </div>
          ) : (
            <Icon
              style={{ opacity: 0.6, marginTop: 30, marginBottom: 30 }}
              name="leaf"
              size="massive"
              color="grey"
            />
          )}
        </div>
      </div>
    </div>
  );
}
