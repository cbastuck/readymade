import { Button } from "semantic-ui-react";
import { RuntimeClassType } from "../../../types";

type Props = {
  name: string;
  type: RuntimeClassType;
  url?: string;
  onRemove: () => void;
};

export default function RuntimeItem({ name, type, onRemove }: Props) {
  return type === "remote" ? (
    <div style={{ display: "flex", flexDirection: "row", width: "100%" }}>
      <div style={{ width: "100%" }}>Add {name}</div>
      <div style={{ padding: 0, marginLeft: "auto", width: 13 }}>
        <Button
          fluid
          style={{ padding: 0, margin: 0 }}
          icon="remove"
          onClick={(ev) => {
            onRemove();
            ev.stopPropagation();
          }}
        />
      </div>
    </div>
  ) : (
    <div> Add {name} </div>
  );
}
