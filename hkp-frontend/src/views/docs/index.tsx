import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";

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

      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Chapter name="Project Scope">
        <Article to="/docs/scope/what">What</Article>
        <Article to="/docs/scope/why">Why</Article>
        <Article to="/docs/scope/how">How</Article>
        <Article to="/docs/scope/identity">Identity</Article>
      </Chapter>

      <Chapter name="Tracks">
        <Article to="/docs/tracks/bridge">Bridge</Article>
        <Article to="/docs/tracks/remote">Remote runtimes</Article>
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
      <br />
    </Template>
  );
}
