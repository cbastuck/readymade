import Template from "../../Template";

import { Section, Text, Paragraph } from "../Elements";
import NavigateButton from "../../NavigateButton";

export default function Multiplication() {
  return (
    <Template title="Multiplication" isRoot={true}>
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Practise multiplication rows">
            <Paragraph>
              A small game I made for my son to practice multiplication rows in
              elementary school
            </Paragraph>
            <NavigateButton
              destination="/playground/multiplication?template=/boards/usecases/multiplication.json"
              text="Show on Playground"
            />
          </Section>
        </Text>
      </div>
    </Template>
  );
}
