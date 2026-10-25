import { useState, useEffect } from "react";
import BipolarMeter from "hkp-frontend/src/ui-components/BipolarMeter";
import { BipolarMeterWidget } from "../../types";
import { useResolvedService } from "../../serviceNotifications";
import { resolvePath } from "../../readValue";
import { WidgetRendererProps } from "../widgetRegistry";

export function BipolarMeterRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<BipolarMeterWidget>) {
  const [value, setValue] = useState<number>(0);

  // Polled for rather than looked up once: a service inside a sub-service is
  // built after the facade first draws.
  const sourceService = useResolvedService(
    boardContext,
    widget.source.serviceUuid,
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
        setValue(val);
      }
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, widget.source.path]);

  return (
    <BipolarMeter
      value={value}
      label={widget.label}
      width={widget.width}
      height={widget.height}
    />
  );
}
