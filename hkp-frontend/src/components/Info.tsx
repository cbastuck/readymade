import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/ui-components/primitives/card";

type Props = {
  headline: string;
  children: JSX.Element | JSX.Element[];
};

export default function Info({ headline, children }: Props) {
  return (
    <Card className="m-2">
      {headline && (
        <CardHeader>
          <CardTitle>{headline}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="text-base mx-4 my-2 p-2">{children}</CardContent>
    </Card>
  );
}
