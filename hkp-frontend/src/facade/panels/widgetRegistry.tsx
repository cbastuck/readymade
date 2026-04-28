import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeWidget } from "../types";
import { KnobRenderer } from "./renderers/KnobRenderer";
import { LevelMeterRenderer } from "./renderers/LevelMeterRenderer";
import { ButtonRenderer } from "./renderers/ButtonRenderer";
import { TextInputRenderer } from "./renderers/TextInputRenderer";
import { QrCodeRenderer } from "./renderers/QrCodeRenderer";
import { FilePickRenderer } from "./renderers/FilePickRenderer";
import { MessageListRenderer } from "./renderers/MessageListRenderer";
import { CanvasRenderer } from "./renderers/CanvasRenderer";
import { XYPadRenderer } from "./renderers/XYPadRenderer";

export type PanelContext = {
  knobValues: Record<string, number>;
  onKnobChange: (serviceUuid: string, value: number) => void;
};

export type WidgetRendererProps<W extends FacadeWidget = FacadeWidget> = {
  widget: W;
  boardContext: BoardContextState;
  panelContext: PanelContext;
};

export const widgetRegistry: Record<
  string,
  React.FC<WidgetRendererProps<any>>
> = {
  knob: KnobRenderer,
  "level-meter": LevelMeterRenderer,
  button: ButtonRenderer,
  "text-input": TextInputRenderer,
  "qr-code": QrCodeRenderer,
  "file-pick": FilePickRenderer,
  "message-list": MessageListRenderer,
  canvas: CanvasRenderer,
  "xy-pad": XYPadRenderer,
};
