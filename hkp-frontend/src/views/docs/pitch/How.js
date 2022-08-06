import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";

export default function How() {
  return (
    <Template title="How could it work" parent="project scope">
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
          A brief story as an intro. When my professional life as an engineer
          began, soon I felt like repeating work I did before. Back then, we
          worked on approaches that would mimick music simlilarity as perceived
          by humans. We created processing pipelines, graphs eventually:
          connected logical units, each with a clear resposibility. Chained
          units would accept an audio stream on the input, next extract
          similarity features from the audio signal, then select the most
          important ones, train classification models, validate those models,
          and finally persist them so models could be used in subsequent queries
          from a frontend.
        </div>
        <div>
          Something similar we did at university. We fed raw volumetric data
          from CT scans to processing units in pipelines for being transformed,
          projected, selected, mapped and eventually visualized as
          semi-transparent, textured rectangles, ordererd and blended over each
          other.
        </div>
        <div>
          Some years later, this common pattern drove the decision to apply to
          Native Instruments. From my experience I felt convinced that any
          instrument they release would be low-level code compositions of
          Reaktor modules. That conviction did not hold long after I started.
          Questions stayed because to many problem the following seemed true: as
          soon as convenient abstractions were found and established, a big part
          of maby core functionalities became nested functions triggering
          continuations of nested functions while propagating data, and so on.
        </div>
        <div>
          That's <i>how</i> it could work in general. Sure, complexity and its
          exponential growth are tough. Especially when applying this pattern to
          arbitrary domains and use-cases. Sometimes it feels impossible when
          looking for perfection and avoid having code in the end again.
          However, if you look with a different pair of glasses, you can see
          great examples:{" "}
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
        Why another approach?
        <ul>
          <li style={{ marginBottom: 5 }}>
            It's fun building abstractions, see them work, watch them fail, then
            understand and start pushing the limits by iterating on multiple
            ends: the runtime, the module, the data, the topology of
            connections. Personally, Hookup as a vehicle allows me to try any
            hat I'd like to wear in a product's lifecycle from time to time.
          </li>
          <li>
            Improving versatility is an interesting problem. Failure is an
            option, still the likelihood a dice produces the desired outcome at
            least once grows with the number of trials. Thus, tackling a problem
            from different perspectives and angles seems reasonable. Small
            algorithmic deviations can have a huge impact.
          </li>
          <li>
            They say the universe is infinite. That's what we tell our software
            programs about space as well while demand and growth accelerate. Why
            this matters in this context? Coincidence or not, it sounds like
            there is a lot to explore.
          </li>
        </ul>
        <div style={{ textAlign: "right", fontSize: 11 }}>June, 24 2022</div>
        <HStack>
          <NavigateButton to="/docs/pitch/why" label="< why?" />
          <NavigateButton to="/examples" label="examples >>" />
        </HStack>
      </div>
    </Template>
  );
}
