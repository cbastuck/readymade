import Template from "../Template";
import Chapter from "./Chapter";
import Article from "./Article";

export default function Docs() {
  return (
    <Template title="Documentation" isRoot={true}>
      <Article isRoot={true} to="/docs/quickstart">
        Quickstarter
      </Article>
      <Article isRoot={true} to="/docs/updates">
        What's new
      </Article>

      <Chapter name="Project Scope">
        <Article to="/docs/pitch/what">What</Article>
        <Article to="/docs/pitch/why">Why</Article>
        <Article to="/docs/pitch/how">How</Article>
      </Chapter>

      <Chapter name="Blog Articles">
        <Article to="/docs/blog/nesting">
          Nesting Boards: Each Puzzle Piece, a Puzzle Itself
        </Article>
        <Article to="/docs/blog/collaboration">
          Human-machine collaboration and Determinism
        </Article>
        <Article to="/docs/blog/slideshow">
          Cast photos from the phone to a Browser on the TV
        </Article>
        <Article to="/docs/blog/game">A playful introduction to Hookup</Article>
      </Chapter>

      <Chapter name="Side tracks" details="topics work in progress">
        <Article to="/docs/tracks/branding">Brand and identity</Article>
        <Article to="/docs/tracks/bridge">Bridge</Article>
        <Article to="/docs/tracks/remote">Remote runtimes</Article>
      </Chapter>
      <br />
    </Template>
  );
}
