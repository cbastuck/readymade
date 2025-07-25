import { useState } from "react";
import { Fullscreen } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { ServiceUIProps } from "../../../types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

import { t } from "../../../styles";
import Button from "hkp-frontend/src/ui-components/Button";

export default function HtmlUI(props: ServiceUIProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlDocument, setHtmlDocument] = useState("");

  const updateState = (cfg: any) => {
    const { fullscreen, html } = cfg;

    if (html !== undefined) {
      setHtmlDocument(html);
    }
    if (fullscreen !== undefined) {
      setIsFullscreen(fullscreen);
    }
  };

  const onInit = (config: any) => {
    updateState(config);
  };

  const onNotification = (notification: any) => {
    updateState(notification);
  };

  const renderFullscreen = () => {
    return (
      <div
        style={{
          position: "fixed",
          width: "100%",
          height: "100%",
          left: 0,
          top: 0,
          background: "white",
          zIndex: 1000,
        }}
      >
        <Button
          className="absolute top-0 right-0"
          onClick={() => setIsFullscreen(false)}
        >
          x
        </Button>
        <div
          className="h-screen flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: htmlDocument }}
          style={t.selectable}
        />
      </div>
    );
  };

  const renderView = () => (
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
            className="w-full"
            dangerouslySetInnerHTML={{ __html: htmlDocument }}
            style={t.selectable}
          />
        ) : null}
      </div>
    </div>
  );

  const customMenuEntries = [
    {
      name: "Fullscreen",
      icon: <MenuIcon icon={Fullscreen} />,
      disabled: isFullscreen,
      onClick: () => {
        props.service.configure({
          fullscreen: true,
        });
      },
    },
  ];
  return (
    <ServiceUI
      {...props}
      customMenuEntries={customMenuEntries}
      className="pb-2 min-h-[100px]"
      initialSize={{ width: 400, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
    >
      {isFullscreen ? renderFullscreen() : renderView()}
    </ServiceUI>
  );
}
