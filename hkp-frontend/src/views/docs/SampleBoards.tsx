import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";

import samples from "./samples";
import BoardManager from "@/ui-components/boardmanager";

export default function SampleBoards() {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <Accordion type="single" collapsible value="item-1">
      <AccordionItem value={isExpanded ? "item-1" : ""} className="border-none">
        <AccordionTrigger onClick={() => setIsExpanded(!isExpanded)}>
          Sample Boards
        </AccordionTrigger>
        <AccordionContent className="text-lg mx-10">
          <div className="text-base">
            A sorted collection of boards from recent to old (from project's
            exploration phase).
          </div>
          <BoardManager boards={samples} hideSearch dateFormat="DD/MM/YYYY" />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
