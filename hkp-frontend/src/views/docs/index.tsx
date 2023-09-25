import Template from "../Template";
import Chapter from "./Chapter";
import Article from "./Article";

export default function Docs() {
  return (
    <Template title="Documentation" isRoot={true}>
      <Article to="/docs/quickstart">1. Quickstarter</Article>
      <Article to="/docs/updates" details="feature log">
        2. What's new
      </Article>

      <Chapter name="3. Project Scope">
        <Article to="/docs/pitch/what">What</Article>
        <Article to="/docs/pitch/why">Why</Article>
        <Article to="/docs/pitch/how">How</Article>
      </Chapter>

      <Chapter name="4. Side tracks" details="topics work in progress">
        <Article to="/docs/tracks/branding">brand and identity</Article>
        <Article to="/docs/tracks/bridge">bridge</Article>
        <Article to="/docs/tracks/remote">remote runtimes</Article>
      </Chapter>
      <br />
    </Template>
  );
}
