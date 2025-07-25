import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";
import Article from "../Article";

export default function Tutorials() {
  return (
    <Accordion type="single" collapsible defaultValue="item-1">
      <AccordionItem value="item-1" className="border-none">
        <AccordionTrigger>Tutorials</AccordionTrigger>
        <AccordionContent className="text-lg ml-10">
          <Article to="/docs/tutorials/starter">
            On-Boarding: Leave Lamp
          </Article>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function P({ children, className, title }: any) {
  return (
    <div className={`py-2 ${className}`}>
      {title && <h3 className="my-2 p-0">{title}</h3>}
      {children}
    </div>
  );
}

export function Note({ children }: any) {
  return <P className="bg-gray-100 p-4 rounded my-2">{children}</P>;
}
