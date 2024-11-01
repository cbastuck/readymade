import { P } from "..";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard3 } from "./boards";

export default function HowItWorks() {
  return (
    <MediaParagraph
      title="How it works"
      video="/assets/tutorials/leavelamp-map-3.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard3 }}
    >
      I use the Injector service to add a button to initiate the flow.
      Naturally, a Leave Lamp wouldn't require an explicit trigger, so this
      setup is just to get started. Injectors are services designed to start a
      flow and can send various data types into it; for this example, I'll use
      an empty JSON object as the trigger.
      <P>
        The map service is used to transform incoming data, typically in JSON
        format. There are two modes: static and dynamic mapping. In a static
        mapping, the result data does not depend on the input or derived context
        data. As shown in the video, a static mapping would yield a constant
        green light.
      </P>
    </MediaParagraph>
  );
}
