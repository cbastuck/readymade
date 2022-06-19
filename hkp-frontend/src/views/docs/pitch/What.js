import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";

export default function What() {
  return (
    <Template title="What's the point" isRoot={true}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 20,
          fontSize: 16,
          fontFamily: "Roboto",
          letterSpacing: 1,
          lineHeight: 1.5,
        }}
      >
        <div>
          Explore ideas to combine logic and create computational behavior with
          a different mindset than strictly an engineering mindset: more playful
          and preferably using less code.
        </div>
        <div>
          Focus on ideas and prototypical solutions that provide insights and
          generate followup questions; and again - prototypes.
        </div>
        <div>
          Iterate on aspects of centrality, connectivity, authority and scale.
          In particular acknowledge small or individual spaces. It could be
          solutions that matter to only a few people - yet, as some problems
          could still be relevant to many.
        </div>
        <div>
          The more we spread the ability to analyze and decompose patterns
          around us, also using technical terms, the more we set the odds for
          finding appropriate solutions, before we need them.
        </div>
        <div>
          This project - Hookup - is an imperfect and naive private endeavour!
          This is an excuse and a disclaimer to set expectations: you will hear
          three chords, not a symphony, in case you decide to continue.
        </div>
        <div>
          Hookup focuses on exploration and less on delivering solutions. It
          should rather tell a story for the interested, one that comes
          unconventional and unpredictable; and hopefully leaves the listener
          puzzled, curious and most important: recognizing possibilties
        </div>
        <div>
          Imperfect solutions can help in formulating new questions. Sometimes
          these become the root thought for identifying the underlying and
          hidden problems.
        </div>
        <div>
          Automation and digitalisation are already on the agenda. Well, and so
          should be upscaling the group of people finding unknown solutions and
          problems, instead of upscaling the number of devices executing known
          solutions to acknowledged problems that rank high in demand and thus
          return of invest.
        </div>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/why" label="why? >" />
        </HStack>
      </div>
    </Template>
  );
}
