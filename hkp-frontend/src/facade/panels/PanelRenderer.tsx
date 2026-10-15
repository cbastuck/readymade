import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadePanel } from "../types";
import { GenericPanel } from "./GenericPanel";
import RenderErrorBoundary from "../../components/RenderErrorBoundary";

export type { PanelProps } from "./GenericPanel";

export type PanelRendererProps = {
  panel: FacadePanel;
  boardContext: BoardContextState;
  showTitle: boolean;
};

export function PanelRenderer(props: PanelRendererProps) {
  return (
    <RenderErrorBoundary
      scope={`Facade panel ${props.panel.title || props.panel.id}`}
      resetKey={props.panel}
    >
      <GenericPanel {...props} />
    </RenderErrorBoundary>
  );
}
