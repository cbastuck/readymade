import Template, { BackButton, NextButton } from "../../Template";

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
          fontSize: 18,
          fontFamily: "Roboto",
          letterSpacing: 1,
          lineHeight: 1.7,
        }}
      >
        <div>
          I believe - within reason - the ability to understand logic, technical
          components and the flow and shape of data, is comparable to the
          ability to read written text. Accordingly, as much as being able to
          read, does not necessarily turn you into a professional author,
          learning to understand technical components and data flows - on a
          maybe visual and more tangible level alone - is different from
          becoming a professional software engineer.
        </div>
        <div>
          However, the ability to read books, stories, recipies, etc. can be
          entertaining, or help you to understand things better. Things like:
          yourself, your environment, our world. It can be an ingredient to find
          your place and contribute to whatever you chose to find important in
          your life or the life of your peers - according your preferences,
          abilities and choices.
        </div>
        <div>
          Over the years I collected experiences and arguments why I would fully
          support someone in their decision of not becoming a professional
          engineer. Some are personal, some are cultural, some are superficial.
          At the same time, the ability to understand and later produce
          technical parts that create computational behavior, visual
          appearances, sonic experiences, entertaining moments and creativity in
          general, formed this thinking that different abstractions and
          approaches to technology and logic are desirable. The possibilities to
          express yourself by building and/or using tools that are a product of
          technology, should not be restricted to a specialized group of people
          with certain traits, matching stereotypes an industry itself
          (re-)produces. Otherwise - in technical terms - we could be climbing
          fast, following a steep gradient, but only towards a local optimum.
          Well, the universe is infinte right? This is what we tell our programs
          as well. Hence, there seems enough space to explore.
        </div>
        <HStack style={{ marginTop: 10 }}>
          <BackButton />
          <NextButton to="/docs/pitch/how" />
        </HStack>
      </div>
    </Template>
  );
}
