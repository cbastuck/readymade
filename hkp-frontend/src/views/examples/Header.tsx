import Breadcrumbs from "./Breadcrumbs";
import { ExampleDescriptor } from "./types";

type Props = {
  example?: ExampleDescriptor;
};
export default function Header({ example }: Props) {
  return (
    <div
      style={{
        margin: "10px",
        textAlign: "center",
      }}
    >
      <h1>Examples</h1>
      {example && <Breadcrumbs current={example} />}
    </div>
  );
}
