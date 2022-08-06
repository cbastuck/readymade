import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";
import Date from "../../../components/Date";

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
          In particular acknowledge small and individual spaces. It could be
          solutions that matter to only a few people - yet some problems might
          be relevant to many.
        </div>
        <div>
          I think, the more we spread the ability to analyze and decompose
          patterns around us, also using technical terms, the more we set the
          odds to find appropriate solutions before we need them.
        </div>
        <div>
          This project - Hookup - is an imperfect and naïve private endeavour!
          This is an excuse and a disclaimer to set expectations: you will hear
          three chords, not a symphony.
        </div>
        <div>
          Hookup focuses on exploration and comparatively little on delivering
          solutions. I'd rather like to tell a story for the interested than
          repeat common tech talk. Stories that come unconventional and less
          predictable; and hopefully leaves someone puzzled, curious and most
          important with an awareness of new possibilties.
        </div>
        <Date month="June" day="24" year="2022" />
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/?page=mission" label="overview" />
          <NavigateButton to="/docs/pitch/why" label="why? >" />
        </HStack>
      </div>
    </Template>
  );
}
