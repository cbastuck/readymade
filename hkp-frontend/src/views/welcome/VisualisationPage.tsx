import SandboxFrame from "../../components/SandboxFrame";
import { redirectTo } from "../../core/actions";

type Props = {
  visualisationFinished: boolean;
  onSetPage: (page: string) => void;
  onVisualisationFinished: () => void;
};
export default function VisualisationPage({
  visualisationFinished,
  onSetPage,
  onVisualisationFinished,
}: Props) {
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
        onAction={({ page, finished, checkpoint }) => {
          if (page) {
            onSetPage(page);
          }
          if (finished) {
            redirectTo("/examples");
          }
          if (checkpoint === "@last-state" && !visualisationFinished) {
            onVisualisationFinished();
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
