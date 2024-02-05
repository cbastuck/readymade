import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";
import Date from "../../../components/Date";

export default function Why() {
  return (
    <Template title="Why does it matter" parent="Project scope">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 20,
        }}
      >
        <div>
          In my humble opinion, the ability to understand technical components
          and data-flows is somewhat comparable to the ability to read.
        </div>
        <div>
          Reading doesn't turn you into an author. Similarly, a basic
          understanding of technical components and data does not turn you into
          a software engineer. Both abilitities are prerequisites for the
          latter.
        </div>
        <div>
          When reading stories, recipies, history, poetry, etc. it can be
          entertaining and lead to a deeper understanding of many things: your
          self, your environment, our world, etc. Maybe you discover unknown
          abilities, interests, places, meaning or something you can't even
          imagine right now.
        </div>
        <div>
          Similarily the ability to use technology to create and express
          yourself can be mind changing. Development is a challenging task. Also
          there are good reasons to decide against a professional path. Still,
          the ability to use tech for your individual purpose, should not be
          restricted to a specialized group of people with certain traits
          matching shallow stereotypes and sometimes even reproducing them.
          Technically speaking, otherwise we could walk a steep slope along the
          gradient to find a local optimum.
        </div>
        <div>
          Automation and digitalisation are part of a public discourse and
          agenda. According this reasoning, so should be upscaling the amount of
          people finding new solutions and discover yet unknown problems.
        </div>

        <Date month="June" day="24" year="2022" />
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/what" label="< what?" />
          <NavigateButton to="/docs/pitch/how" label="how? >" />
        </HStack>
      </div>
    </Template>
  );
}
