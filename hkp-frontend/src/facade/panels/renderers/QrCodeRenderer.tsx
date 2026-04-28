import { useState, useEffect, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { QrCodeWidget } from "../../types";
import { findService, resolvePath } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

export function QrCodeRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<QrCodeWidget>) {
  const [url, setUrl] = useState("");

  const sourceService = useMemo(
    () => findService(boardContext, widget.source.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.source.serviceUuid],
  );

  useEffect(() => {
    if (!sourceService?.app) {
      return;
    }
    const handler = (notification: any) => {
      const val = widget.source.path
        ? resolvePath(notification, widget.source.path)
        : notification;
      if (typeof val === "string" && val) {
        setUrl(val);
      }
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    const currentUrl = sourceService.state?.url;
    if (typeof currentUrl === "string" && currentUrl) {
      setUrl(currentUrl);
    }
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, widget.source.path]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {url ? (
          <QRCodeCanvas value={url} size={250} />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "hsl(var(--muted))",
              borderRadius: 8,
              color: "hsl(var(--muted-foreground))",
              fontSize: 13,
              textAlign: "center",
              padding: 16,
            }}
          >
            Waiting for QR code…
          </div>
        )}
      </div>
      {widget.caption && (
        <div
          style={{
            fontSize: 13,
            color: "hsl(var(--muted-foreground))",
            textAlign: "center",
          }}
        >
          {widget.caption}
          <div className="text-center">
            (
            <a href={url} target="_blank">
              link
            </a>
            )
          </div>
        </div>
      )}
    </div>
  );
}
