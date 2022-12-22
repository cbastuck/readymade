import { Message, Button, Icon } from "semantic-ui-react";

export default function Notification({ value, onClose }) {
  const { type, message, ctas = [] } = value;
  return (
    <Message info={type === "info"} error={type === "error"}>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div style={{ width: "100%", marginTop: 5 }}>{message}</div>
        {ctas
          .filter((cta) => !!cta.callback)
          .map((cta) => (
            <Button
              key={`notification-cta-${cta.label}`}
              style={{ width: "auto" }}
              size="mini"
              basic
              positive={cta.positive}
              negative={cta.negative}
              onClick={() => cta.callback(onClose)}
              icon={cta.icon}
            >
              {cta.icon ? null : cta.label}
            </Button>
          ))}
        <Button
          basic
          color="red"
          style={{ width: "auto" }}
          size="mini"
          onClick={onClose}
          icon={<Icon name="close" />}
        />
      </div>
    </Message>
  );
}
