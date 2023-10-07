import { Button } from "semantic-ui-react";

type Props = {
  message: string;
  onClose: () => void;
};

export default function NotificationContent({ message, onClose }: Props) {
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
