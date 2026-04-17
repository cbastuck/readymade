import { useState, useEffect, useMemo } from "react";
import LevelMeter from "hkp-frontend/src/ui-components/LevelMeter";
import { LevelMeterWidget } from "../../types";
import { findService, resolvePath } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

export function LevelMeterRenderer({
  widget,
  boardContext,
  panelContext,
}: WidgetRendererProps<LevelMeterWidget>) {
  const [level, setLevel] = useState<number>(widget.min ?? -60);

  const sourceService = useMemo(
    () => findService(boardContext, widget.source.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.source.serviceUuid],
  );

  useEffect(() => {
    if (!sourceService?.app) {
      return;
    }
    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      const val = widget.source.path
        ? resolvePath(notification, widget.source.path)
        : notification;
      if (typeof val === "number" && Number.isFinite(val)) {
        setLevel(val);
      }
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, widget.source.path]);

  const threshold =
    widget.thresholdKnobServiceUuid !== undefined
      ? panelContext.knobValues[widget.thresholdKnobServiceUuid]
      : undefined;

  return (
    <LevelMeter
      value={level}
      min={widget.min ?? -60}
      max={widget.max ?? 0}
      unit={widget.unit ?? "dB"}
      threshold={threshold}
    />
  );
}
