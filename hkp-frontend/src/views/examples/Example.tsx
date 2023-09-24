import { useLocation, Location } from "react-router-dom";

import Explanation from "./Explanation";
import Sandbox from "../../Sandbox";

import { ExampleDescriptor } from "./types";
import Header from "./Header";

import { t } from "../../styles";

import examples from "./ExamplesData";
import { redirectTo } from "../../core/actions";

export default function Example() {
  const location = useLocation();
  const descriptor = parseUrl(location);
  if (!descriptor) {
    console.error(`Invalid example: ${location.search}`);
    return redirectTo("/examples");
  }

  return (
    <div style={{ height: "100%", marginTop: 20 }}>
      <Header example={descriptor} />
      <div style={{ margin: 40, height: "100%" }}>
        <div style={t.fill}>
          <div style={{ maxHeight: "20%", overflowY: "auto" }}>
            <Explanation value={descriptor.explanation} />
          </div>
          <div style={{ marginTop: 5 }}>
            <Sandbox src={descriptor.url} />
          </div>
        </div>
      </div>
    </div>
  );
}

function parseUrl(location: Location): ExampleDescriptor | undefined {
  const search = location && location.search;
  if (!search) {
    return undefined;
  }
  const params = new URLSearchParams(search);
  const exampleUrl = params && params.get("url");
  if (!exampleUrl) {
    return undefined;
  }
  return examples.find((ex) => ex.url === exampleUrl);
}
