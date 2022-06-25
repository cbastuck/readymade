import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";

export default function Why() {
  return (
    <Template title="Why does it matter" isRoot={false}>
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
          In my opinion, the ability to understand logic and technical
          components including data in its shape and flow is comparable to the
          ability to read.
        </div>
        <div>
          Being able to read, doesn't immediately turn you into an author.
          Similar, learning to understand technical components and data flows
          does not determine anyone to be or become a software engineer. Both
          abilitities are only prerequisites for the latter, not more. At least
          on a professional level. Looking at it from the perspective of an
          individual's life in general, it's different.
        </div>
        <div>
          For example, the ability to read stories, recipies, history, poetry,
          etc. can entertain and help to understand things better. Things like:
          your self, your environment, our world. Sometimes it's one ingredient
          to discover abilities, interests, your position or place or whatever
          you chose to find important in your life and the life of your peers.
        </div>
        <div>
          From experience, I understand anyone not wanting to get into
          professional software development.
        </div>
        <div>
          But still, the ability to understand and produce software to create
          computational behavior, visual effects, audio experiences,
          entertaining moments and creativity in general, reassure my interest
          for abstractions and approaches to technology that feel more
          approachable.
        </div>
        <div>
          The possibilities to express yourself through artifacts made with
          technology, should not be restricted to a specialized group with
          certain traits, matching stereotypes an industry alone produces and
          sometimes even reproduces. Otherwise, we could follow a steep slope
          along the gradient, but merely towards a local optimum.
        </div>
        <div>
          They say the universe is infinite. That's what we tell our software
          programs about space as well while demand and growth accelerates. Why
          this matters? I think it sounds like there is a lot to explore.
        </div>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/what" label="< what?" />
          <NavigateButton to="/docs/pitch/how" label="how? >" />
        </HStack>
      </div>
    </Template>
  );
}
