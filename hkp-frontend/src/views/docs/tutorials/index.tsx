import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";
import Article from "../Article";

export default function Tutorials() {
  return (
    <Accordion type="single" collapsible defaultValue="item-1">
      <AccordionItem value="item-1" className="border-none">
        <AccordionTrigger>Tutorials</AccordionTrigger>
        <AccordionContent className="text-lg ml-10">
          <Article to="/docs/tutorials/starter">Lesson 1: Leave Lamp</Article>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
