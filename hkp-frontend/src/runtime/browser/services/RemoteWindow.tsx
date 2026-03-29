import { useRef, useEffect } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceId = "hookup.to/service/remote-window";
const serviceName = "RemoteWindow";

/*
function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
*/

function RemoteWindowUI(props: any): JSX.Element {
  const windowRef = useRef<Window | undefined>(undefined);
  const fullscreenRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    windowRef.current = window.open(undefined, "remote", undefined) ?? undefined;
  }, []);

  const update = (value: any): void => {
    const wdw = windowRef.current;
    if (!wdw) return;
    const doc = wdw.document;
    if (!doc.title) {
      doc.title = "Hookup Remote";
    }

    if (!value.bot) {
      doc.body.appendChild(
        doc.createElement("h1").appendChild(doc.createTextNode(value.user))
          .parentNode as Node
      );
      const link = doc
        .createElement("a")
        .appendChild(doc.createTextNode(value.meta.uri)).parentNode as HTMLAnchorElement;
      link.setAttribute("href", value.meta.uri);
      link.setAttribute("target", "_blank");
      doc.body.appendChild(link);
    }
  };

  return (
    <ServiceUI
      {...props}
      onInit={(service: any) => { fullscreenRef.current = service.fullscreen; }}
    >
      {({ service }: { service: any }) => service && service.register(update) && <div />}
    </ServiceUI>
  );
}

class RemoteWindow {
  uuid: string;
  board: any;
  app: any;
  callback?: (params: any) => void;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  register(callback: (params: any) => void): boolean {
    this.callback = callback;
    return true;
  }

  configure(_config: any): void {}

  process(params: any): any {
    if (this.callback) {
      this.callback(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new RemoteWindow(app, board, _descriptor, id),
  createUI: RemoteWindowUI,
};

export default descriptor;
