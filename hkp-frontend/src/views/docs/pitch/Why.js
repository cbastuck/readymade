import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";

export default function Why() {
  return (
    <Template title="Why does it matter" isRoot={true}>
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
          components, including the flow and shape of data is - to some extend -
          comparable to the ability to read.
        </div>
        <div>
          As being able to read, does not immediately turn you into an author,
          learning to understand technical components and data flows does not
          determine anyone for being or becoming a software engineer. Both
          abilitities are a prerequisite for the latter, not more. At least on a
          professional level. Looking at the context of that person's life in
          general, it's a different story.
        </div>
        <div>
          The ability to read books, stories, recipies, etc. can be
          entertaining, or help you to understand things better. Things like:
          yourself, your environment, our world. It can be an ingredient to find
          your place and contribute to whatever you chose to find important in
          your life or the life of your peers - according your preferences,
          abilities and choices.
        </div>
        <div>
          From experience I can see myself supporting anyone deciding against
          being a professional engineer. Some arguments might be personal, some
          cultural, some may be superficial. At the same time, the ability to
          understand and later produce technical parts that create computational
          behavior, visual appearances, sonic experiences, entertaining moments
          and creativity in general, formed this thinking that different
          abstractions and approaches to technology and logic are desirable. The
          possibilities to express yourself by building and/or using tools that
          are a product of technology, should not be restricted to a specialized
          group of people with certain traits, matching stereotypes an industry
          itself (re-)produces. Otherwise - in technical terms - we could be
          climbing fast, following a steep gradient, but only towards a local
          optimum. Well, the universe is infinte right? This is what we tell our
          programs as well. Hence, there seems enough space to explore.
        </div>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/what" label="< what?" />
          <NavigateButton to="/docs/pitch/how" label="how? >" />
        </HStack>
      </div>
    </Template>
  );
}
