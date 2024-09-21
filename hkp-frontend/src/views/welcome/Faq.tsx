import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";

export default function Faq() {
  const s = "pb-2 px-4 text-left tracking-widest";
  return (
    <div className="flex flex-col">
      <div className="text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[70%] gap-4">
        Describing this app in one sentence is challenging. Although, there are
        many similarities to existing tools and approaches. However, most of
        them take a different turn eventually. In this section, I try to answer
        common questions about the scope and motivation of this project.
        Hopefully, it helps to figure it out. If not, more details can be found{" "}
        <a href="https://hookup.to">here</a>.
      </div>

      <div className="mt-4 mb-10 text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[70%] gap-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="faq-2">
            <AccordionTrigger className="text-left">
              {" "}
              Is this a low-code thing?
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Personally, I think fully replacing code is not a realisitc
                option. Additionally, what is considered code? A declarative
                configuration document can be quite similar to programming
                language code. In this context some low-code™ marketing claims
                and promises feel a bit shallow.{" "}
              </div>
              <div className={s}>
                Therefore, I think the low-code tag does not really match.
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
                Generative AI models can be excellent assistants — ideal rubber
                ducks, supportive proof-readers, and much more. The
                collaborative nature of AI-assisted workflows sounds much more
                appealing to me than fully outsourcing to AI.{" "}
              </div>
              <div className={s}>
                The degree of control feels important. Instead of opting for a
                black box that for example fully manages and optimizes my day, I
                would prefer breaking it into smaller blocks where I can author
                some and understand or tweak others that are generated. These
                aspects and values should be reflected in this app.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-6">
            <AccordionTrigger className="text-left">
              Give me a brief description!
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                This app is an integration tool. It enables you to compose
                behaviors by connecting semantically meaningful building blocks.
              </div>
              <div className={s}>
                That's the best brief, I found so far. I know it's still too
                abstract. Still, it's a working solution that will evolve with
                the app.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-7">
            <AccordionTrigger className="text-left">
              What are key characteristics!
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Everything you build with this app is inherently asynchronous,
                distributed, and heterogeneous. This means, the smallest
                building blocks (services) operate at their own pace, some run
                on the device while others operate on remote devices - and they
                can be implemented in any programming language compatible with
                existing adapters. Think of these building blocks as functions
                that receive data, process it, and pass on the result. Data
                flows through subsequent blocks as a continuous stream.
              </div>
              <div className={s}>
                Personally, I like the metaphor of water carrying small rocks,
                minerals, and other elements along its flow, constantly changing
                and transforming according to the environment it passes through.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
