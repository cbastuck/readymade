import Template from "../../Template";
import TemplateButton from "../../TemplateButton";

import { HStack } from "../../../styles";
import Text from "hkp-frontend/src/ui-components/Text";
import Date from "../../../components/Date";

export default function Why() {
  return (
    <Template title="Why does it matter" parent="Project scope">
      <div className="flex flex-col gap-[10px] mt-[20px]">
        <Text>
          In my humble opinion, the ability to comprehend technical components
          and data flows is comparable to the skill of reading. Just as reading
          doesn't automatically make you an author, a foundational understanding
          of technical components and data doesn't turn you into a software
          engineer. Instead, both abilities serve as prerequisites for the
          latter. I believe these skills are crucial in today's digital age,
          allowing individuals to navigate the digital landscape without
          everyone needing to pursue a career as a software engineer.
        </Text>

        <Text>
          When reading stories, recipes, history, poetry, etc., it can be
          entertaining and lead to a deeper understanding of many things:
          yourself, your environment, our world, etc. Maybe you discover unknown
          abilities, interests, places, meaning, or something you can't even
          imagine right now. Similarly, the ability to use technology to create
          and express yourself can be mind-changing. While professional
          development in technology is a challenging task and may not be the
          path for everyone, the capacity to use tech for individual purposes
          should not be restricted to a specialized group of people with certain
          traits that match shallow stereotypes, sometimes even reproducing
          them. Otherwise, we risk walking a steep slope along the gradient to
          find a local optimum.
        </Text>
        <Text>
          As automation and digitalization become integral to public discourse
          and agendas, so too should the focus shift towards empowering more
          individuals to discover new solutions and uncover yet-unknown
          problems.
        </Text>

        <Date month="June" day="24" year="2022" />
        <Date isUpdate month="February" day="8" year="2024" size={10} />

        <HStack style={{ marginTop: "10px" }}>
          <TemplateButton to="/docs/scope/what" label="< what?" />
          <TemplateButton to="/docs/scope/how" label="how? >" />
        </HStack>
      </div>
    </Template>
  );
}
