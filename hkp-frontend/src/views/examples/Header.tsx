import Breadcrumbs from "./Breadcrumbs";
import { ExampleDescriptor } from "./types";

type Props = {
  example?: ExampleDescriptor;
};
export default function Header({ example }: Props) {
  return (
    <div
      style={{
        margin: "10px 10px",
        textAlign: "center",
        marginBottom: 20,
      }}
    >
      <h1 style={{ margin: 0, padding: 0 }}>
        <div
          className="hkp-fnt-family hkp-fnt-color"
          style={{
            letterSpacing: 8,
            fontSize: 20,
            marginTop: 15,
          }}
        >
          Examples
        </div>
      </h1>
      {example && <Breadcrumbs current={example} />}
    </div>
  );
}
