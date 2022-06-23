import { Link } from "react-router-dom";

import Template, { NavigateButton } from "../../Template";

import { HStack } from "../../../styles";

export default function How() {
  return (
    <Template title="How could it work" isRoot={true}>
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
          Following story: When my professional life as an engineer began, soon
          I felt like repeating work I did before. Back then, we worked on
          approaches that would mimick the sensation of music simlilarity as
          perceived by humans. We created processing pipelines, graphs
          eventually: connected logical units, each with a clear resposibility.
          Chained units would accept an audio stream on the input, next extract
          similarity features from the audio signal, then select the most
          important ones, train classification models, validate those models,
          and finally persist them so models could be used in subsequent queries
          from a frontend.
        </div>
        <div>
          Something similar we did at university, where we fed raw volumetric
          data from CT scans to processing units in pipelines to transform,
          project, select, map and eventually visualize the resulting data as
          semi-transparent, textured rectangles, ordererd and blended over
          another.
        </div>
        <div>
          Some years later, this common pattern drove my decision to apply at
          Native Instruments. From my mentioned experience I was convinced that
          any instrument they release would be low-level code compositions of
          <a href="https://en.wikipedia.org/wiki/Reaktor" target="blank">
            {" Reaktor "}
          </a>
          modules. That conviction did not hold long after I started, also some
          of my core assumptions were wrong. But the sense of repetition stayed;
          once convenient abstractions were found, a big part of core
          functionality became nested functions triggering continuations of
          nested functions while propagating data, and so on.
        </div>
        <div>
          To make it short, it's hard to keep complexity and its exponential
          growth in balance. If you're looking for perfection, I think it's an
          almost impossible task. But if you look with a different pair of
          glasses, I think there are great examples of such idea:{" "}
          <Link to="https://nodered.org/">NodeRed</Link>,{" "}
          <Link to="https://www.knime.com/">Knime</Link>,{" "}
          <Link to="https://puredata.info/">PureData</Link>,{" "}
          <Link to="https://vvvv.org/">vvvv</Link>, etc.
        </div>
        Why saddle up Rosinante, when perfection seems condemned in advance?
        <ul>
          <li>
            It's fun building abstractions, see them working, watch them fail,
            then understand and start pushing the limits by iterating on
            multiple ends: the runtime, the module, the data, the topology of
            connections.
          </li>
          <li>Partial correctness outweighs having no clue.</li>
        </ul>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/why" label="< why?" />
          <NavigateButton to="/examples" label="examples >>" />
        </HStack>
      </div>
    </Template>
  );
}
