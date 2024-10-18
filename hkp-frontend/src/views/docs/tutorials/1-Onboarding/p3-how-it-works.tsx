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
      I use the Injector service for having a button to start the flow.
      Certainly, a Leave Lamp would not require an explicit trigger, so this is
      to get started. Injectors are services to start a flow and can pump many
      data types into the flow; let's use an empty JSON object as a trigger.
      <P>
        The map service transforms incoming data, preferably JSON data. There
        are two different modes: static or dynamic mapping. In a static mapping
        the result data, does not the depend on the input or derived context
        data. The video shows a static mapping. The result of this would be a
        constant green light.
      </P>
    </MediaParagraph>
  );
}
