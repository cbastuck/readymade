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
      In a dynamic mapping the input data serves as a parameter to a Javascript
      function that is dynamically evaluated based on the input data and the
      context. The key of a dynamic mapping always ends with a{" "}
      <Equal className="inline" size={16} /> sign. For switching between static
      and dynamic mode, you can also use the{" "}
      <FunctionSquare className="inline" size={16} /> button.
      <P>
        With that in mind, let's simplify the solution and assume a ride leaves
        every ten minutes. Further, the first ride starts at the full hour and
        continues on a constant schedule day and night. In this case a dynamic
        mapping computes the time between the current minute and the next
        interval, via division by ten and taking the reminder. If the remainder
        is less than three minutes, I won't make it in time and the light should
        be red.
      </P>
    </MediaParagraph>
  );
}
