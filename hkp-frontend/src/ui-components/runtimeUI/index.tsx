import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Header from "./Header";
import { RuntimeDescriptor } from "@/types";

type Props = {
  runtime: RuntimeDescriptor;
  onAction: () => void;

  children?: JSX.Element | JSX.Element[];
  renderHeadline?: boolean;
};

export default function RuntimeUI({
  runtime,
  onAction,
  children,
  renderHeadline = true,
}: Props) {
  return (
    <Card>
      <Header renderHeadline={renderHeadline} />
      <CardContent>
        <div>
          {runtime && renderActualRuntime(headless)}
          {((services && services.length === 0) || !isOwner) && !headless && (
            <div style={{ height: showSettings ? 180 : 10 }} /> // just a placeholder for visual consistence
          )}
        </div>
        {children && (
          <div
            style={{
              margin: "5px",
              padding: 10,
              border: "dashed 1px lightgray",
              borderRadius: 5,
            }}
          >
            <div style={{ marginBottom: 5 }} />
            {children}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between"></CardFooter>
    </Card>
  );
}
