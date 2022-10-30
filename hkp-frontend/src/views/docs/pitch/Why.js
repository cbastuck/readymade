import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";
import Date from "../../../components/Date";

export default function Why() {
  return (
    <Template title="Why does it matter" parent="project scope">
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
          I think the ability to understand technical components and data-flows
          is comparable to the ability to read.
        </div>
        <div>
          This ability doesn't immediately turn you into an author. Similarly, a
          basic understanding of technical components and data does not turn you
          into a software engineer. Both abilitities are only prerequisites for
          the latter, nothing more.
        </div>
        <div>
          Reading stories, recipies, history, poetry, etc. can be entertaining
          and lead to a deeper understanding of: your self, your environment,
          our world, etc. It could be a source to discover unknown abilities,
          interests, places, meaning or whatever someone finds important in
          their life.
        </div>
        <div>
          Being a software engineer can be challenging and there are good
          reasons to decide against this path. But nevertheless, the ability to
          use tech to create and express yourself, can be mind changing and
          should not be restricted to a specialized group of people with certain
          traits, matching stereotypes an industry produces and sometimes even
          reproduces. Otherwise, we could follow a steep slope along the
          gradient, but merely towards a local optimum.
        </div>
        <div>
          Automation and digitalisation are part of a public discourse. So
          should be upscaling the amount of people finding new solutions and
          unknown problems.
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
