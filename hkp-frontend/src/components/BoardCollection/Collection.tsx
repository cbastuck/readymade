import { Card as SuiCard } from "semantic-ui-react";

import Card from "./Card";
import { UsecaseDescriptor } from "./types";

type Props = {
  filter: string;
  items: Array<UsecaseDescriptor>;
  height?: string | number;
};

export default function Collection({ items, filter, height = "100%" }: Props) {
  return (
    <SuiCard.Group
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
          <Card key={x.name} value={x} />
        ))}
    </SuiCard.Group>
  );
}
