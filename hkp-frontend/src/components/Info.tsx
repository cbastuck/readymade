import { Card, CardHeader, CardContent } from "@/ui-components/primitives/card";

type Props = {
  headline: string;
  children: JSX.Element | JSX.Element[];
};

export default function Info({ headline, children }: Props) {
  return (
    <Card className="m-2">
      {headline && (
        <CardHeader>
          <h1>{headline}</h1>
        </CardHeader>
      )}
      <CardContent className="text-base mx-4 my-2 p-2">{children}</CardContent>
    </Card>
  );
}
