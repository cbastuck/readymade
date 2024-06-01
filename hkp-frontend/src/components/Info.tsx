import { Card, CardHeader, CardContent } from "@/ui-components/primitives/card";

type Props = {
  className?: string;
  headline: string;
  children: JSX.Element | Array<JSX.Element | string> | string;
};

export default function Info({ className, headline, children }: Props) {
  return (
    <Card className={`${className} m-2`}>
      {headline && (
        <CardHeader>
          <h1>{headline}</h1>
        </CardHeader>
      )}
      <CardContent className="text-base mx-4 my-2 p-2 tracking-wider font-serif">
        {children}
      </CardContent>
    </Card>
  );
}
