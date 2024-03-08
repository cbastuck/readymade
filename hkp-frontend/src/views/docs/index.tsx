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

      <Chapter name="4. Blog Articles">
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

      <Chapter name="5. Side tracks" details="topics work in progress">
        <Article to="/docs/tracks/branding">Brand and identity</Article>
        <Article to="/docs/tracks/bridge">Bridge</Article>
        <Article to="/docs/tracks/remote">Remote runtimes</Article>
      </Chapter>
      <br />
    </Template>
  );
}
