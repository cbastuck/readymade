import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";

export default function What() {
  return (
    <Template title="What's the point" parent="project scope">
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
          Explore ideas to combine logic and create computed behavior with a
          different mindset than strictly an engineering mindset: more playful
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
          I think the more we spread the ability to analyze and decompose
          patterns around us, also using technical terms, the more we set the
          odds to find appropriate solutions before we need them.
        </div>
        <div>
          This project - Hookup - is an imperfect and naive private endeavour!
          This is an excuse and a disclaimer to set expectations: you will hear
          three chords, not a symphony.
        </div>
        <div>
          Hookup focuses on exploration and less on delivering solutions. I
          would rather like to tell a story for the interested than repeat the
          usual tech talk. A story that comes unconventional and less
          predictable; and hopefully leaves the audience puzzled, curious and
          most important with an awareness for new possibilties.
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>June, 24 2022</div>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/?page=mission" label="overview" />
          <NavigateButton to="/docs/pitch/why" label="why? >" />
        </HStack>
      </div>
    </Template>
  );
}
