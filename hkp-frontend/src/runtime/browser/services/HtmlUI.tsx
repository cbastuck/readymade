import { useState } from "react";
import Checkbox from "@/ui-components/Checkbox";

import { ServiceImpl, ServiceUIProps } from "../../../types";

import { t } from "../../../styles";
import ServiceUI from "@/ui-components/service/ServiceUI";

export default function HtmlUI(props: ServiceUIProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlDocument, setHtmlDocument] = useState("");

  const updateState = (cfg: any) => {
    const { fullscreen, html } = cfg;
    if (fullscreen !== undefined) {
      setIsFullscreen(fullscreen);
    }

    if (html !== undefined) {
      setHtmlDocument(html);
    }
  };

  const onInit = (config: any) => {
    updateState(config);
  };

  const onNotification = (notification: any) => {
    updateState(notification);

    if (notification.html && props.service.fullscreen) {
      document.body.innerHTML = notification.html;
    }
  };

  const renderView = (service: ServiceImpl) => (
    <div className="h-full w-full flex flex-col gap-4">
      <div
        className="text-base"
        style={{
          width: "100%",
          height: "100%",
          maxHeight: "400px",
          overflow: "auto",
          textAlign: "left",
        }}
      >
        {htmlDocument ? (
          <div
            dangerouslySetInnerHTML={{ __html: htmlDocument }}
            style={t.selectable}
          />
        ) : (
          "Render Area"
        )}
      </div>

      <div className="text-left my-1">
        <Checkbox
          title="Fullscreen"
          checked={isFullscreen}
          onChange={async (checked) => {
            service.configure({
              fullscreen: checked,
            });
          }}
        />
      </div>
    </div>
  );

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      initialSize={{ width: 350, height: 280 }}
      onInit={onInit}
      onNotification={onNotification}
    >
      {renderView(props.service)}
    </ServiceUI>
  );
}
