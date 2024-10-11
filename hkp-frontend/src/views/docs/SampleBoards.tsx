import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";

import samples from "./samples";
import BoardManager from "@/ui-components/boardmanager";

export default function SampleBoards() {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1" className="border-none">
        <AccordionTrigger>Sample Boards</AccordionTrigger>
        <AccordionContent className="text-lg">
          <BoardManager boards={samples} hideSearch dateFormat="DD/MM/YYYY" />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
