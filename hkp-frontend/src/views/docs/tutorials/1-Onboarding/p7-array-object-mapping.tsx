import { Note, P } from "..";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard7 } from "./boards";
import Plug from "@/assets/plug.svg?react";
import ArrayPlug from "@/assets/plugArray.svg?react";
import { useTheme } from "@/ui-components/ThemeContext";

export default function ArrayObjectMapping() {
  const theme = useTheme();
  return (
    <MediaParagraph
      title="Array and Object Mapping"
      video="/assets/tutorials/leavelamp-map-7.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard7 }}
    >
      Let's remove another simplification which makes the leave lamp mostyl
      unusable at the moment: I only consider the upcoming departure, although
      there might be multiple upcoming departures in the fetched time window.
      So, if the next departure would leave in one minute, the lamp would show a
      red light, even if another departure would leave in four minutes. Let's
      fix this by mapping the whole array of departures instead of just the
      first one. The map service can handle both arrays and objects. If the
      input is an array, the map service will iterate over each element and
      apply the mapping to each element. If the input is an object, the map
      service will apply the mapping to the object itself. By introducing a new
      map service that takes the array of departures from the resulting json
      structure and puts this into the following services, the runtime generates
      a multiple time diffs, including debug information for each upcoming
      departure.
      <P>
        By using just <code>=</code> as mapping key, the service can replace the
        whole input (<code>params</code>) by the mapped value without wrapping
        it into an object.
        <P>
          For example: <code>=</code> as key and <code>params.departures</code>{" "}
          as value, will replace the whole input by the departures array. In
          contrast <code>x=</code> as key and <code>params.departures</code> as
          value, will create on object with a property x, and this contains the
          departures array.
        </P>
      </P>
      <Note>
        Whether a service outputs scaler data type, or an array, is visualised
        at the output of a service. The single{" "}
        <Plug
          className="inline"
          width="15px"
          stroke={theme.accentColor}
          fill={theme.accentColor}
        />{" "}
        symbol indicates a scalar output. The double{" "}
        <ArrayPlug className="inline" width="20px" fill={theme.accentColor} />{" "}
        symbol indicates an array output.
      </Note>
    </MediaParagraph>
  );
}
