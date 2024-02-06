import { Card as SCard } from "semantic-ui-react";
import Card, { Action } from "./Card";
import { SavedBoard, UsecaseDescriptor } from "../../types";
import { ReactElement } from "react";

type Props = {
  filter: string;
  items: Array<UsecaseDescriptor> | Array<SavedBoard>;
  actions?: Array<{ name: string; icon: ReactElement }>;
  onAction?: (action: Action, item: UsecaseDescriptor | SavedBoard) => void;
  height?: string | number;
};

export default function Collection({
  items,
  filter,
  actions,
  onAction,
  height = "100%",
}: Props) {
  return (
    <SCard.Group
      style={{
        height,
        width: "100%",
        overflowY: "auto",
        padding: "0px 3px",
      }}
    >
      {items
        .filter((x) => !filter || x.name.toLowerCase().indexOf(filter) !== -1)
        .map((x) => (
          <Card key={x.name} value={x} actions={actions} onAction={onAction} />
        ))}
    </SCard.Group>
  );
}
