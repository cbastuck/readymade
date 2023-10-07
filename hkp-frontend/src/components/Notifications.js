import { Message, Button } from "semantic-ui-react";

import { s, t } from "../styles";

function NotificationContent({ message, onClose }) {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ padding: "8px 5px" }}>{message}</div>
      {onClose && (
        <Button
          style={{ marginLeft: "auto", backgroundColor: "inherit", width: 40 }}
          compact
          onClick={onClose}
          icon="close"
        />
      )}
    </div>
  );
}

const margins = { margin: 0, marginTop: 5 };

export function ErrorNotification({
  message = "",
  title = "Error",
  onClose,
  style = {},
}) {
  if (!message) {
    return false;
  }

  return (
    <Message
      style={s(t.uc, t.ls1, t.fs12, { padding: 5, ...margins, ...style })}
      header={title}
      content={<NotificationContent message={message} onClose={onClose} />}
      negative
    />
  );
}

export function InfoNotification({
  message = "",
  title = "Info",
  onClose,
  style = {},
}) {
  if (!message) {
    return false;
  }

  return (
    <Message
      style={s(t.uc, t.ls1, t.fs12, { padding: 5, ...margins, ...style })}
      header={title}
      content={<NotificationContent message={message} onClose={onClose} />}
      positive
    />
  );
}
