import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";

import samples from "./samples";
import BoardManager from "hkp-frontend/src/ui-components/boardmanager";

type Props = {
  headline?: string;
  hideDate?: boolean;
};

export default function SampleBoards({
  headline = "Demo Apps",
  hideDate,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  return headline ? (
    <Accordion type="single" collapsible value="item-1">
      <AccordionItem value={isExpanded ? "item-1" : ""} className="border-none">
        <AccordionTrigger onClick={() => setIsExpanded(!isExpanded)}>
          {headline}
        </AccordionTrigger>
        <AccordionContent className="text-lg mx-10">
          <div className="text-base">
            A sorted collection of boards from recent to old (from project's
            exploration phase).
          </div>
          <BoardManager
            boards={samples}
            hideSearch
            dateFormat="DD/MM/YYYY"
            hideDate={hideDate}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ) : (
    <BoardManager
      boards={samples}
      hideSearch
      dateFormat="DD/MM/YYYY"
      hideDate={hideDate}
    />
  );
}
