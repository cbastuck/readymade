import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadePanel } from "../types";
import { GenericPanel } from "./GenericPanel";

export type { PanelProps } from "./GenericPanel";

export type PanelRendererProps = {
  panel: FacadePanel;
  boardContext: BoardContextState;
  showTitle: boolean;
};

export function PanelRenderer(props: PanelRendererProps) {
  return <GenericPanel {...props} />;
}
