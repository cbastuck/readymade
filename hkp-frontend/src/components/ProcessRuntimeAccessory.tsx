import { Button } from "semantic-ui-react";

type Props = {
  onProcess: () => void;
};

export default function ProcessRuntimeAccessory({ onProcess }: Props) {
  return (
    <Button.Group
      basic
      size="mini"
      style={{
        height: 19,
      }}
    >
      <Button
        icon="play"
        size="mini"
        style={{
          width: 30,
          padding: 0,
          border: "none",
          backgroundColor: "transparent",
        }}
        onClick={onProcess}
      />
    </Button.Group>
  );
}
