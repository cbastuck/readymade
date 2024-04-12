//import Breadcrumbs from "./Breadcrumbs";
import Breadcrumbs from "@/ui-components/Breadcrumbs";
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
      {example && (
        <Breadcrumbs
          path={[
            { value: "Examples", link: "/examples" },
            { value: example.title },
          ]}
        />
      )}
    </div>
  );
}
