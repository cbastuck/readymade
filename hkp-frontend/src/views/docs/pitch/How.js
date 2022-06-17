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
          Shortly after starting my professional engineering path, I felt
          repeating myself, implementing a similar concept a second time. We
          worked on algorithms trying to mimick the ability to judge music
          simlilarity as perceived by humans, based on the music signal only. We
          ended up writing processing pipelines, graphs eventually: connected
          processing units that accept an audio stream at the input, extract
          similarity features, select the most important ones, train
          classification models, validate those models, and eventually persist
          them for a query from a frontend.
        </div>
        <div>
          Something similar we did at university. Here, we fed raw volumetric
          data from computed tomography scans to pipeline objects, which
          preprocessed, projected, selected, mapped and eventually visualized
          data as slices of textures blended over each other.
        </div>
        <div>
          Eventually that common pattern made me apply for a job at Native
          Instruments where - before starting - I was convinced that every
          instrument they release, would be more or less a composition of
          low-level
          <a href="https://en.wikipedia.org/wiki/Reaktor" target="blank">
            {" Reaktor "}
          </a>
          modules, connected on a code level, nested function calls basically. I
          learned that things are different and partially understood why. Still,
          the voice arguing, that as soon as logic turns into convenient
          abstractions everything is more or less nested function calls - ie.
          units in processing pipelines passing and processing data - was there.
          One argument: if it works in the real-time audio domain (Reaktor), it
          should work for the general purpose. The thing about complexity and
          its exponential growth is hard to overlook, still, if you try hard, it
          looks like it could work for at least some other cases as well. And,
          there are others who applied this to other cases as well: NodeRed,
          Knime, etc.
        </div>
        To conclude this story, by now you can derive two things:
        <ul>
          <li>
            it must be a lot of fun, still trying what works, and exploring how
            to make it work, partially, nevertheless
          </li>
          <li>
            it does not match your expectation and you could save valuable time
            by continueing your research{" "}
            <a href="https://duckduckgo.com/">here</a>
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
