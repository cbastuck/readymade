import { CSSProperties } from "react";
import { Link } from "react-router-dom";

import { Breadcrumb } from "semantic-ui-react";
import { ExampleDescriptor } from "./types";

type Props = {
  current: ExampleDescriptor;
};
export default function Breadcrumbs({ current }: Props) {
  const breadcrumpStyle: CSSProperties = {
    letterSpacing: 1,
    fontSize: 12,
    margin: "0px 2px",
  };

  const currentExample = current;
  return (
    <div
      style={{
        textAlign: "left",
        marginLeft: 5,
      }}
    >
      <Breadcrumb>
        <Breadcrumb.Section>
          <Link style={breadcrumpStyle} to="/examples">
            Examples
          </Link>
        </Breadcrumb.Section>
        <Breadcrumb.Divider />
        {currentExample && (
          <Breadcrumb.Section link>
            <span style={breadcrumpStyle}>{currentExample.title}</span>
          </Breadcrumb.Section>
        )}
      </Breadcrumb>
    </div>
  );
}
