import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";

export default function Faq() {
  const s = "pb-2 px-4 text-left tracking-widest";
  return (
    <>
      <h1 className="py-10 pt-4 md:pt-10 mx-0 mb-2 md:text-center">FAQ</h1>
      <div className=" text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[70%] gap-4">
        Giving one sentence to describe this app is hard, although there are
        many similarities to existing tools and approaches. Most of them take a
        different turn eventually. Hopefully this section still helps to figure
        it out. If not, more detailed information about the underlying project,
        the scope and the initial motivation can be found{" "}
        <a href="https://hookup.to">here</a>
      </div>

      <div className="mt-4 mb-10 text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[70%] gap-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="faq-2">
            <AccordionTrigger> Is this a low-code thing?</AccordionTrigger>
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
            <AccordionTrigger>
              Is this a visual programming thing?
            </AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Visual programming is an appealing idea. An image can be worth a
                thousand words. But these words need to come in a specifc order
                to convey the correct idea within the context of a program.
              </div>

              <div className={s}>
                Boxes and arrows seem easy to grasp as long as all arrows model
                the same relation and exhibit the same behavior. This certainly
                impacts the expressiveness of a visual language. Adding arrow
                variants or in general abstractions introduces a trade-off
                between expressiveness and the requirement of still being easier
                to digest than code.
              </div>
              <div className={s}>
                In the end, it should be fun and easy to write, read, maintain,
                merge, review, etc. In these areas, code is still ahead in some
                respects.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-4">
            <AccordionTrigger>Is this for quick prototyping?</AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Yes, a big part of it involves testing ideas and getting an
                early understanding of how they would play out.{" "}
              </div>
              <div className={s}>
                Sometimes, a prototype might be enough for a niche idea,
                immediately providing the intended value. In such cases, it
                could be considered more of a solution than a prototype. While
                it's probably not a solution that would be comparable to
                professional products running at scale, it offers a custom and
                individual solution. And the path to arrive there, hopefully
                feels more direct and welcoming, without requiring a computer
                science degree beforehand.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-5">
            <AccordionTrigger>Isn't this a job for AI?</AccordionTrigger>
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
            <AccordionTrigger>Give me a brief description!</AccordionTrigger>
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
            <AccordionTrigger>What are key characteristics!</AccordionTrigger>
            <AccordionContent className="text-base font-serif">
              <div className={s}>
                Composed behavior is inherently asynchronous, distributed, and
                heterogeneous. This means, blocks operate at their own pace,
                some run on the device while others operate on remote devices -
                and they can be implemented in any programming language
                compatible with existing adapters. Think of these building
                blocks as functions that receive data, process it, and pass on
                the result. Data flows through subsequent blocks as a continuous
                stream.
              </div>
              <div className={s}>
                Personally, I like the metaphor of water carrying small rocks,
                minerals, and other elements along its flow, ever-changing and
                transforming according to the environment it passes through.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
