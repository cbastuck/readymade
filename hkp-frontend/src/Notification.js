import { Message, Button } from "semantic-ui-react";

export default function Notification({ value, onClose }) {
  const { type, message } = value;
  return (
    <Message info={type === "info"} error={type === "error"}>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div style={{ width: "100%", marginTop: 5 }}>{message}</div>
        <Button style={{ width: "auto" }} size="mini" onClick={onClose}>
          x
        </Button>
      </div>
    </Message>
  );
}
