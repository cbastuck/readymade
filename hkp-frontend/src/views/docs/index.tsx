import Template from "../Template";
import Article from "./Article";
import Tutorials from "./tutorials";

import SampleBoards from "./SampleBoards";

// import LegacyDocs from "./LegacyDocs";

export default function Docs() {
  return (
    <Template
      title="Documentation"
      isRoot={true}
      width="90%"
      compactToolbar={false}
    >
      <div className="mt-10">
        <Article isRoot={true} to="/docs/quickstart">
          Quickstarter
        </Article>
      </div>

      <div className="py-2">
        <Article isRoot={true} to="/docs/updates">
          What's new
        </Article>
      </div>

      <Tutorials />

      <SampleBoards />

      <br />
    </Template>
  );
}
