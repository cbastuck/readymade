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
          generate new questions and again new prototypes.
        </div>
        <div>
          Iterate on aspects of centrality, connectivity, authority and scale.
          In particular acknowledge small or individual spaces. It could be
          solutions that matter to only a few people - yet some problems might
          be relevant to many.
        </div>
        <div>
          The more we spread the ability to analyze and decompose patterns
          around us, also using technical terms, the more we set the odds to
          find appropriate solutions before we need them.
        </div>
        <div>
          This project - Hookup - is an imperfect and naive private endeavour!
          This is an excuse and a disclaimer to set expectations: you will hear
          three chords, not a symphony.
        </div>
        <div>
          I focus on exploration and less on delivering solutions. I rather
          would like to tell a story for the interested, than repeat the usual
          tech talk. Tell a story that comes unconventional and unpredictable;
          and hopefully leaves the audience puzzled, curious and most important
          with an awareness for new possibilties.
        </div>
        <div>
          In my opinion imperfect solutions can create understanding and lead to
          new, improved ideas. Some might become a root thought to identify
          underlying and so far hidden problems.
        </div>
        <div>
          Automation and digitalisation are on a public agenda. And so should be
          upscaling the group of people finding unknown solutions and problems,
          instead of only upscaling the number of devices executing known
          solutions to acknowledged problems.
        </div>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/why" label="why? >" />
        </HStack>
      </div>
    </Template>
  );
}
