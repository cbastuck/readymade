import React from "react";
import { Icon } from "semantic-ui-react";

import { s, t } from "../../styles";

export default function EmptySketch({ boardName }) {
  const headline = !boardName ? (
    "Feels boring here!"
  ) : (
    <span style={s(t.tc, t.fs16, t.uc, t.ls1)}>
      Playground <span style={t.italic}>{boardName}</span> is empty{" "}
    </span>
  );
  return (
    <div style={{ margin: headline && "15px 0px" }}>
      {headline && (
        <div style={{ marginTop: 20 }}>
          <h1 style={s(t.fs16, t.tc, t.m(0, 6))}> {headline} </h1>
        </div>
      )}
      <div style={{ padding: headline && "20px 0px" }}>
        <div style={s(t.tc, t.mt0, t.mb30)}>
          <Icon
            style={{ opacity: 0.6, marginTop: 30, marginBottom: 30 }}
            name="leaf"
            size="massive"
            color="grey"
          />
        </div>
        <div style={s(t.uc, t.fs14, t.ls1, t.tc)}>
          <span
            style={{ cursor: "help", color: "#4284C4" }}
            onClick={() => {
              const selector = document.getElementById("runtime-dropdown");
              if (selector) {
                selector.focus();
                selector.click();
              }
            }}
          >
            {" add a runtime "}
          </span>
          to sketch an idea
          <Icon
            name="idea"
            style={{ marginTop: -20 }}
            color="grey"
            size="big"
          />
        </div>
      </div>
    </div>
  );
}
