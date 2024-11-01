import { FunctionSquare, Equal } from "lucide-react";

import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard4 } from "./boards";
import { P } from "..";

export default function DynamicMapping() {
  return (
    <MediaParagraph
      title="Dynamic Mapping"
      video="/assets/tutorials/leavelamp-map-4.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard4 }}
    >
      In dynamic mapping, the input data acts as a parameter to a JavaScript
      function that is dynamically evaluated based on both the input data and
      context. The key for a dynamic mapping always ends with a
      <Equal className="inline" size={16} /> sign. You can switch between static
      and dynamic modes by using the{" "}
      <FunctionSquare className="inline" size={16} /> button.
      <P>
        The JavaScript function can access the input data using the{" "}
        <code>params</code> variable. Additionally, some helper functions are
        exposed, and a detailed list of these will be provided in a separate
        tutorial later.
      </P>
      <P>
        With this in mind, let's simplify the solution by assuming a ride
        departs every ten minutes. Additionally, the first ride starts on the
        hour and follows a constant schedule, day and night. In this case, a
        dynamic mapping can compute the time until the next interval by dividing
        the current minute by ten and taking the remainder. If the remainder is
        less than three minutes, I won't make it in time, so the light should
        turn red.
      </P>
    </MediaParagraph>
  );
}
