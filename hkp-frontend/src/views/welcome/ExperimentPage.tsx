import { useState } from "react";

import SandboxFrame from "../../components/SandboxFrame";

import NavigateButton from "../NavigateButton";

export default function ExperimentPage() {
  const [visualisationFinished, setVisualisationFinished] = useState(false);
  return (
    <div className="flex flex-col h-full w-[50%] mx-auto">
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
        <div className="fade-in-linear">
          <NavigateButton destination="/examples" text="Show some Examples" />
        </div>
      )}
    </div>
  );
}
