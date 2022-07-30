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
          A quick story as an intro. When my professional life as an engineer
          began, soon I felt like repeating work I did before. Back then, we
          worked on approaches that would mimick music simlilarity as perceived
          by humans. We created processing pipelines, graphs eventually:
          connected logical units, each with a clear resposibility. Chained
          units would eventually accept an audio stream on the input, next
          extract similarity features from the audio signal, then select the
          most important ones, train classification models, validate those
          models, and finally persist them so models could be used in subsequent
          queries from a frontend.
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
          Native Instruments. From the mentioned experience I was convinced that
          any instrument they release would be low-level code compositions of
          <a href="https://en.wikipedia.org/wiki/Reaktor" target="blank">
            {" Reaktor "}
          </a>
          modules. That conviction did not hold long after I started. Also some
          of my core assumptions were wrong. But the sense of repetition stayed;
          once convenient abstractions were found, a big part of core
          functionality became nested functions triggering continuations of
          nested functions while propagating data, and so on.
        </div>
        <div>
          So, that's the <i>how</i>. I acknowledge, it's hard to keep complexity
          and its exponential growth in balance when it comes to applying this
          approach to arbitrary domains and use-cases. If you're looking for
          perfection, sometimes it feels almost impossible to achieve that
          without end up engineering again. However if you look with a different
          pair of glasses, you see great examples:{" "}
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
            connections. Hookup is my vehicle to wear any hat in the lifecycle
            of a product from time to time.
          </li>
          <li>
            Partial correctness outweighs having no clue. You need to start
            somewhere to improve versatility. Failure is an option and the more
            we try, the more it happens. But also the odds to improve
            iteratively when taking different perspectives and angles on the
            problem.
          </li>
          <li>
            They say the universe is infinite. That's what we tell our software
            programs about space as well while demand and growth accelerates.
            Why this matters in this context? I think it sounds like there is a
            lot to explore.
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
