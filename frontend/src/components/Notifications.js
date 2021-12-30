import React from "react";
import { Message, Button } from "semantic-ui-react";

import { s, t } from "../styles";

export function ErrorNotification({
  message = "",
  title = "",
  onClose = () => {},
}) {
  if (!message) {
    return false;
  }
  const content = (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ padding: "8px 5px" }}>{message}</div>
      <Button
        style={{ marginLeft: "auto", backgroundColor: "inherit", width: 40 }}
        compact
        onClick={onClose}
        icon="close"
      />
    </div>
  );
  return (
    <Message
      style={s(t.uc, t.ls1, t.fs12, { padding: 5, margin: "5px 0px" })}
      header={title}
      content={content}
      negative
    />
  );
}
