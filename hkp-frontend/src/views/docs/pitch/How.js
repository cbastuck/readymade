import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";
import Date from "../../../components/Date";

export default function How() {
  return (
    <Template title="How could it work" parent="Project scope">
      <div
        className="hkp-fnt-p"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 20,
          fontSize: 14,
        }}
      >
        <div>
          A brief story. When my life as a professional engineer began, I soon
          felt like repeating work I did before. We worked on approaches that
          would mimick music simlilarity as perceived by humans. We created
          processing pipelines, graphs eventually: connected logical units, each
          with a clear resposibility. Sequentially linked units that would
          accept audio on the input, then extract similarity features from the
          audio signal, then select the most important ones, then train
          classification models, then validate these models, and finally persist
          them, so they could be used for queries.
        </div>
        <div>
          A similar pattern we applied at university in the domain of
          visualisation. We fed raw volumetric data from CT scans to processing
          units. Again, these were organised in pipelines. The units
          transformed, projected, selected, mapped and eventually visualized the
          input data as semi-transparent, textured rectangles, ordererd and
          blended over each other.
        </div>
        <div>
          Years later, I was working for the company that built the music tool
          Reaktor. Actually, this product was one of the reasons, why I applied.
          From my experience, I "felt" convinced that any instrument they
          release would be low-level code compositions of Reaktor modules. That
          conviction did not hold long after I started - still the pipeline
          pattern re-occured multiple times again. So much for the <i>how</i>.
        </div>
        <div>
          I know, complexity and its exponential growth are non-negotiable. In
          particular, when applying this pattern to arbitrary domains and
          use-cases. Perfection might be impossible in terms of not coding in
          the end again. But when I look with an optimistic pair of glasses, I
          notice a vibrant dynamic in this area:{" "}
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
        </div>
        <div>
          So then, why Hookup? Honestly, sometimes it feels like I don't have a
          choice. It's fun building abstractions, see them work, watch them
          fail, then understand and start pushing the limits by iterating on
          multiple ends: the runtime, the module, the data, the topology of
          connections.
        </div>
        <div>
          Hookup allows me to try many hats, in a product's lifecycle. I
          consider this as one root to grow.
        </div>
        <div>
          One last important aspect: curiosity and naivity. "They say the
          universe is infinite. Funny, that's what we tell our software about
          space as well, while demand and growth accelerate." Why this matters
          here? I think, it sounds like there is a lot to explore - in general.
        </div>
        <Date month="June" day="24" year="2022" />
        <HStack>
          <NavigateButton to="/docs/pitch/why" label="< why?" />
          <NavigateButton to="/docs" label="docs" />
          <NavigateButton to="/examples" label="examples >" />
        </HStack>
      </div>
    </Template>
  );
}
