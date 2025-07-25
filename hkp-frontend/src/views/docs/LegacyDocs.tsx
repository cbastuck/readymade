import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";
import Article from "./Article";

export default function LegacyDocs() {
  return (
    <>
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-none">
          <AccordionTrigger>Project Scope</AccordionTrigger>
          <AccordionContent className="text-lg ml-10">
            <Article to="/docs/scope/what">What</Article>
            <Article to="/docs/scope/why">Why</Article>
            <Article to="/docs/scope/how">How</Article>
            <Article to="/docs/scope/identity">Identity</Article>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-none">
          <AccordionTrigger>Tracks</AccordionTrigger>
          <AccordionContent className="text-lg ml-10">
            <Article to="/docs/tracks/bridge">Bridge</Article>
            <Article to="/docs/tracks/remote">Remote runtimes</Article>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-none">
          <AccordionTrigger>Blog Articles</AccordionTrigger>
          <AccordionContent className="text-lg ml-10">
            <Article to="/docs/blog/nesting">
              Nesting Boards: Each Puzzle Piece, a Puzzle Itself
            </Article>
            <Article to="/docs/blog/collaboration">
              Human-machine collaboration and Determinism
            </Article>
            <Article to="/docs/blog/slideshow">
              Cast photos from the phone to a Browser on the TV
            </Article>
            <Article to="/docs/blog/game">
              A playful introduction to Hookup
            </Article>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
