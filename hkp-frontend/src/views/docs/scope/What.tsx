import Template from "../../Template";
import TemplateButton from "../../TemplateButton";

import { HStack } from "../../../styles";
import Date from "../../../components/Date";
import Text from "hkp-frontend/src/ui-components/Text";

export default function What() {
  return (
    <Template title="What's the point" parent="Project scope">
      <div className="flex flex-col gap-[10px] mt-[20px]">
        <Text>
          In this project, I embark on the creation and synthesis of logical
          blocks to bring arbitrary computational behaviors to life. Emphasizing
          simplicity, I adopt a playful mindset, striving for the resulting
          composition from the synthesized blocks to rely on as little code as
          possible. My focus revolves around generating ideas and prototypical
          solutions within the domains of centrality, connectivity, authority,
          and scale.
        </Text>

        <Text>
          Think of prototypes as flexible building blocks. They're made up of
          reusable parts and, interestingly, can serve as a logical unit in
          crafting new prototypes. While the modular approach may add
          intricacies, it reveals interdependencies within the logic. This
          method not only makes algorithms almost tangible but also keeps them
          highly adaptable. Even after a prototype is formed, its logical units
          remain parametrizable - allowing for dynamic adjustments in
          algorithmic behavior. What's particularly intriguing is that this
          parametrization can be driven by human inputs or, by machines
          leveraging artificial intelligence.
        </Text>
        <Text>
          This unique quality positions the model as an excellent interface for
          collaboration between humans and machines. It allows adaptable
          algorithms while keeping control, enabling adjustments to specific
          inputs. This controlled adaptability instills confidence in the
          interface, mitigating concerns about maintaining oversight and
          influence in the AI landscape.
        </Text>
        <Text>
          In considering scale, I acknowledge the importance of addressing small
          or individual spaces. Through an accessible interface, we empower more
          individuals to navigate and explore these niches, unlocking the
          potential for a variety of technical solutions that might otherwise go
          unnoticed or underserved
        </Text>
        <Text>
          Hookup is more about exploration than delivering concrete solutions. I
          pursue it because it helps my thought process and enables the telling
          of unconventional stories—narratives designed to raise awareness of
          new possibilities and hidden abilities that individuals might possess.
        </Text>

        <Date month="June" day="24" year="2022" />
        <Date isUpdate month="February" day="8" year="2024" size={10} />

        <HStack>
          <TemplateButton to="/welcome/mission" label="overview" />
          <TemplateButton to="/docs/scope/why" label="why? >" />
        </HStack>
      </div>
    </Template>
  );
}
