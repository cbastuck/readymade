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
          Explore ideas to combine logic blocks and create computational
          behavior with a curious mindset: more playful and preferably using
          less code.
        </div>
        <div>
          Focus on ideas and prototypical solutions which provide insights and
          lead to new questions and new prototypes eventually. Especially in the
          domains of: centrality, connectivity, authority and scale while
          acknowledging small or individual spaces.
        </div>
        <div>
          Hookup is about exploration and little about delivering concrete
          solutions. I build it to help my personal thought process and to tell
          unconventional stories that ideally create an awareness of new
          possibilties.
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
