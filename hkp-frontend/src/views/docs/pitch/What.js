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
          With this project, I explore ideas to combine logic blocks to create
          computational behavior with a curious mindset: more playful and
          preferably using less code. I focus on ideas and prototypical
          solutions within following domains: centrality, connectivity,
          authority and scale.
        </div>
        <div>
          Prototypes are modular and composed of versatile, reusable blocks.
          Even if it complicates things at times, the modular approach exhibits
          interdependencies in the logic. This makes algorithms almost tangible,
          creates insights and leads to new questions and eventually new
          prototypes exhibiting different characteristics inherent to the
          solution - or sometimes even to the problem. With respect to scale, I
          acknowledge small or individual spaces.
        </div>
        <div>
          Hookup is about exploration and little about delivering concrete
          solutions. I make it, because it helps my thought process and enables
          to tell unconventional stories. Stories that should create an
          awareness for new possibilties and hidden abilities that one might
          have.
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
