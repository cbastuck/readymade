import Card from "./Card";
import { ExampleDescriptor } from "./types";

type Props = {
  examples?: Array<ExampleDescriptor>;
};

export default function CardContainer({ examples = [] }: Props) {
  return (
    <div className="flex w-full flex-wrap">
      {examples.map((ex) => (
        <Card key={ex.url} example={ex} />
      ))}
    </div>
  );
}
