import Template from "../../Template";

import { Section, Text } from "../Elements";

export default function Order() {
  return (
    <Template title="Order" parent="Prototypes">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Async ordering of food and beverages">
            Decentralised
          </Section>
        </Text>
      </div>
    </Template>
  );
}
