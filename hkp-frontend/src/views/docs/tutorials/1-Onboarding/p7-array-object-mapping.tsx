import { Note, P } from "..";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard7 } from "./boards";
import Plug from "hkp-frontend/src/assets/plug.svg?react";
import ArrayPlug from "hkp-frontend/src/assets/plugArray.svg?react";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";

export default function ArrayObjectMapping() {
  const theme = useTheme();
  return (
    <MediaParagraph
      title="Array and Object Mapping"
      video="/assets/tutorials/leavelamp-map-7.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard7 }}
    >
      Let's address another simplification that currently makes the leave lamp
      mostly unusable: it only considers the next departure, even though there
      may be multiple upcoming departures within the fetched time window. For
      example, if the nearest departure is in one minute, the lamp would show a
      red light, even if another departure is scheduled in four minutes. To fix
      this, we should map the entire array of departures instead of just the
      first one. The map service can handle both arrays and objects: if the
      input is an array, the map service will iterate over each element and
      apply the mapping; if the input is an object, the map service will apply
      the mapping directly to the object. By introducing a new map service that
      takes the array of departures from the resulting JSON structure and passes
      it to the subsequent services, the runtime generates multiple time
      differences, including debug information for each upcoming departure.
      <P>
        By using <code>=</code> as the mapping key, the service can replace the
        entire input (<code>params</code>) with the mapped value, avoiding any
        wrapping into an object.
        <P>
          For example: using <code>=</code> as key and{" "}
          <code>params.departures</code> as value will replace the entire input
          with the departures array. In contrast using <code>x=</code> as the
          key and <code>params.departures</code> as the value will create an
          object with a property x containing the departures array.
        </P>
      </P>
      <Note>
        Whether a service outputs a scalar data type or an array is indicated at
        the service's output. A single{" "}
        <Plug
          className="inline"
          width="15px"
          stroke={theme.accentColor}
          fill={theme.accentColor}
        />{" "}
        symbol represents a scalar output, while a double{" "}
        <ArrayPlug className="inline" width="20px" fill={theme.accentColor} />{" "}
        symbol indicates an array output.
      </Note>
    </MediaParagraph>
  );
}
