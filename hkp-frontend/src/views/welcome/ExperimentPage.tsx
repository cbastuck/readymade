import { useState } from "react";

import SandboxFrame from "../../components/SandboxFrame";
import { redirectTo } from "../../core/actions";

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
        <button
          style={{
            fontSize: 12,
            textTransform: "uppercase",
          }}
          className="button fade-in-linear"
          onClick={() => redirectTo("/examples")}
        >
          Examples
        </button>
      )}
    </div>
  );
}
