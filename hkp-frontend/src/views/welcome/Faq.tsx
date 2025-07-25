import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";

export default function Faq() {
  const s = "pb-2 px-4 text-left tracking-widest";
  return (
    <div className="flex flex-col">
      <div className="flex flex-col text-xl overflow-hidden tracking-widest text-justify mt-10">
        <h2>Frequently asked Questions</h2>
      </div>
      <div className="mt-4 mb-10 text-xl overflow-hidden tracking-widest text-justify gap-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="faq-2">
            <AccordionTrigger className="text-left">
              {" "}
              Is this a low/no-code thing?
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Personally, I think fully replacing code is not a realisitc
                option. Additionally, what is considered code? A declarative
                configuration document can be challenging to read, similar to
                code of an unknown programming language.
              </div>
              <div className={s}>
                Further I feel some no-code™ marketing claims and promises
                appear a bit shallow and optimistic. Therefore, I think the
                low-code tag does not really match.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-3">
            <AccordionTrigger className="text-left">
              Is this a visual programming thing?
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Visual programming is an appealing concept. An image can be
                worth a thousand words, but within the context of a program,
                those words need to be in a specific order to convey the correct
                idea.
              </div>

              <div className={s}>
                Boxes and arrows seem easy to grasp as long as all arrows
                represent the same relation and exhibit the same behavior.
                However, this simplicity impacts the expressiveness of a visual
                language. Introducing arrow variants or other abstractions
                involves a trade-off between increased expressiveness and the
                need to remain easier to digest than code.
              </div>
              <div className={s}>
                In the end, it should be fun and easy to write, read, maintain,
                merge, review, etc. In these aspects, code still has an
                advantage in some respects.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-4">
            <AccordionTrigger className="text-left">
              Is this for quick prototyping?
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Yes, a big part of it involves testing ideas and getting an
                early understanding of how they would play out.{" "}
              </div>
              <div className={s}>
                Sometimes, a prototype might be sufficient for a niche idea,
                immediately delivering the intended value. In such cases, it
                could be seen more as a solution than a prototype. While it's
                likely not a solution comparable to professional products
                running at scale, it offers a custom and personalized approach.
                And the path to get there, hopefully, feels more direct and
                welcoming, without requiring a computer science degree.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-5">
            <AccordionTrigger className="text-left">
              Isn't this a job for AI?
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                I want to express my ideas and thoughts because I enjoy the
                creative process. Similarly, I wouldn't buy a robot to play
                tennis for me if I enjoy playing the game.
              </div>
              <div className={s}>
                Generative AI models can serve as excellent assistants—ideal
                rubber ducks, supportive proofreaders, and much more. The
                collaborative nature of AI-assisted workflows is much more
                appealing to me than fully outsourcing tasks to AI.
              </div>
              <div className={s}>
                Control is an important factor for me. Instead of opting for a
                black box that fully manages and optimizes my day, I would
                prefer to break it into smaller segments where I can author some
                tasks and understand or tweak others that are generated. These
                aspects and values of control should be reflected in this app.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
