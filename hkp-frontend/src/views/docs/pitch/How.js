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
          Following story: When my professional engineering life started, soon I
          felt like repeating work: implementing a concept a second time. Back
          then, we worked on approaches that would mimick the sensation of music
          simlilarity as perceived by the human. We created processing
          pipelines, graphs eventually: connected processing units that accept
          an audio stream on the input, extract similarity features from the
          audio signal, select the most important ones, train classification
          models, validate those models, and persist them so they could be used
          in subsequent queries from a frontend.
        </div>
        <div>
          Something similar we did at university, where we fed raw volumetric
          data from CT scans to processing units in pipelines that transform,
          project, select, map and eventually visualize resulting data as
          semi-transparent, textured rectangles, ordererd and blended over
          another.
        </div>
        <div>
          Some years later, this common pattern drove my decision to apply at
          Native Instruments. From my mentioned experience I was convinced, that
          any instrument they release, would be a low-level code compositions of
          <a href="https://en.wikipedia.org/wiki/Reaktor" target="blank">
            {" Reaktor "}
          </a>
          modules. That conviction did not hold long after I started, also some
          core assumptions were wrong. But, the sense of repetition stayed: once
          convenient abstractions were found a big part of core functionality
          became nested functions triggering continuations of nested functions
          while propagating data, and so on.
        </div>
        <div>
          To make it short, it's hard to keep complexity and its exponential
          growth somehow in balance. If you're looking for perfection, I think
          it's impossible. But if you look careful I think that there are great
          implementations of the basic idea:{" "}
          <Link to="https://nodered.org/">NodeRed</Link>,{" "}
          <Link to="https://www.knime.com/">Knime</Link>,{" "}
          <Link to="https://puredata.info/">PureData</Link>,{" "}
          <Link to="https://vvvv.org/">vvvv</Link>, etc.
        </div>
        Why saddle up the Rosinante, when its perfection seems comcondemned in
        advance?
        <ul>
          <li>
            It's fun, building abstractions and then understanding and pushing
            their limits from multiple ends: the runtime, the module, the data
          </li>
          <li>
            Partial correctness ultimately outweighs not having a clue at all.
          </li>
        </ul>
        <HStack style={{ marginTop: 10 }}>
          <NavigateButton to="/docs/pitch/why" label="< why?" />
          <NavigateButton to="/examples" label="examples >>" />
        </HStack>
      </div>
    </Template>
  );
}
