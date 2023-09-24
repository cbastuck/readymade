import { Card as SCard } from "semantic-ui-react";

import Card from "./Card";
import { ExampleDescriptor } from "./types";

type Props = {
  examples?: Array<ExampleDescriptor>;
};

export default function CardContainer({ examples = [] }: Props) {
  return (
    <SCard.Group style={{ display: "flex", width: "100%" }}>
      {examples.map((ex) => (
        <Card key={ex.url} example={ex} />
      ))}
    </SCard.Group>
  );
}
