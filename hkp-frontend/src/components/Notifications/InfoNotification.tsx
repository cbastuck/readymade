import { CSSProperties } from "react";
import { Message } from "semantic-ui-react";

import NotificationContent from "./NotificationContent";
import { s, t } from "../../styles";

type Props = {
  message: string | undefined;
  title: string;
  style: CSSProperties;
  onClose: () => void;
};

export function InfoNotification({
  message = "",
  title = "Info",
  onClose,
  style = {},
}: Props) {
  if (!message) {
    return false;
  }

  const margins = { margin: 0, marginTop: 5 };

  return (
    <Message
      style={s(t.uc, t.ls1, t.fs12, { padding: 5, ...margins, ...style })}
      header={title}
      content={<NotificationContent message={message} onClose={onClose} />}
      positive
    />
  );
}
