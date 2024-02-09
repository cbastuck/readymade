import { useState } from "react";

import SandboxFrame from "../../components/SandboxFrame";

import NavigateButton from "../NavigateButton";

export default function VisualisationPage() {
  const [visualisationFinished, setVisualisationFinished] = useState(false);
  return (
    <div style={{ height: "100%" }}>
      <SandboxFrame
        title="Hookup Visualisation"
        src="/boards/visualisation.json"
        frameless={true}
        frameBorder={0}
        height="95%"
        width="100%"
        maxWidth={800}
        onAction={({ checkpoint }) => {
          if (checkpoint === "@last-state" && !visualisationFinished) {
            setVisualisationFinished(true);
          }
        }}
      />
      {visualisationFinished && (
        <div className=" fade-in-linear">
          <NavigateButton
            destination="/examples"
            text="Examples"
            style={{ color: "#454f6e", fontSize: 14, border: "1px white" }}
          />
        </div>
      )}
    </div>
  );
}
