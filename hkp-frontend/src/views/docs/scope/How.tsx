import Template from "../../Template";
import TemplateButton from "../../TemplateButton";

import { HStack } from "../../../styles";
import Date from "../../../components/Date";
import Text from "hkp-frontend/src/ui-components/Text";

export default function How() {
  return (
    <Template title="How could it work" parent="Project scope">
      <div className="flex flex-col gap-[10px] mt-[20px]">
        <Text>
          Over the years, I found myself repeatedly involved in implementing
          modular pipelines to address business needs. When I started as a
          software engineer, we focused on approaches to mimic music similarity
          as perceived by humans. This led to the creation of processing
          pipelines—eventual graphs with interconnected logical units, each with
          a clear responsibility. These sequentially linked units would accept
          audio input, extract similarity features from the audio signal, select
          the most important ones, train classification models, validate these
          models, and finally persist them for use in queries.
        </Text>
        <Text>
          A similar pattern had already emerged during my university experience,
          particularly in the domain of visualization. We channeled raw
          volumetric data from computed tomography scans through processing
          units, once more organized in pipelines. These units executed
          transformations, projections, selections, mappings, and eventually
          visualized the input data as semi-transparent, textured rectangles,
          ordered and blended seamlessly over each other.
        </Text>
        <Text>
          Years later, I found myself working for the company that developed the
          music tool Reaktor. In fact, it was one of the main reasons I applied.
          Despite my initial belief that any instrument they released would be
          low-level code compositions of Reaktor modules, this conviction
          shifted shortly after I started. Nevertheless, the familiar pipeline
          pattern resurfaced multiple times, reinforcing the <i>How</i> embodied
          in this project.
        </Text>
        <Text>
          I understand that complexity and its exponential growth are
          non-negotiable, especially when applying this pattern to arbitrary
          domains and use-cases. Achieving perfection in terms of avoiding
          coding altogether may be impossible in the end. However, viewed
          through an optimistic lens, a vibrant dynamic emerges in this space:{" "}
          <a href="https://nodered.org" target="_blank" rel="noreferrer">
            NodeRed
          </a>
          ,{" "}
          <a href="https://www.knime.com/" target="_blank" rel="noreferrer">
            Knime
          </a>
          ,{" "}
          <a href="https://puredata.info/" target="_blank" rel="noreferrer">
            PureData
          </a>
          ,{" "}
          <a href="https://vvvv.org/" target="_blank" rel="noreferrer">
            vvvv
          </a>
          , etc.
        </Text>
        <Text>
          So then, why Hookup? Honestly, at times, it feels more like a
          necessity than a choice. There's a joy in constructing abstractions,
          observing them in action, witnessing their challenges, understanding,
          and then pushing the limits through iterations on multiple fronts: the
          runtime, the module, the data, the topology of connections. Hookup
          allows me to try on many hats throughout a product's lifecycle,
          considering it as a foundational root to grow. One last important
          aspect: curiosity and naivity.
        </Text>
        <Text>
          They say the universe is infinite. It's interesting how, in our
          software, we echo the same sentiment about space while facing
          accelerating demands and growth. Why does this matter here? I believe
          it resonates with the idea that there is a vast realm to explore, both
          conceptually and practically — in general.
        </Text>

        <Date month="June" day="24" year="2022" />
        <Date isUpdate month="February" day="8" year="2024" size={10} />

        <HStack gap="20px">
          <TemplateButton to="/docs/scope/why" label="< why?" />
          <TemplateButton to="/examples" label="examples" />
          <TemplateButton to="/welcome/pitch" label="pitch >" />
        </HStack>
      </div>
    </Template>
  );
}
