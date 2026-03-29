import { useRef, useEffect } from "react";

import ServiceUI from "../../services/ServiceUI";
import { AppImpl, ServiceClass, ServiceUIProps } from "../../../types";

const serviceId = "hookup.to/service/media-player";
const serviceName = "Media Player";

export function MediaPlayerUI(props: ServiceUIProps) {
  const createdObjectUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      resetIfNeeded();
    };
  }, []);

  const onInit = (initialState: object) => {
    // no-op: original just called setState with spread
  };

  const onNotification = (params: any) => {
    const { process: data } = params;
    if (audioRef.current && data) {
      resetIfNeeded();
      if (data instanceof Blob) {
        playBlob(data);
      } else {
        throw new Error("Unsupported media format");
      }
    }
  };

  const playBlob = (blob: Blob) => {
    try {
      if (audioRef.current) {
        createdObjectUrlRef.current = URL.createObjectURL(blob);
        audioRef.current.src = createdObjectUrlRef.current;
        audioRef.current.play();
      }
    } catch (err) {
      console.error("MediaPlayer error creating object URL", err);
    }
  };

  const resetIfNeeded = () => {
    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }
  };

  const renderMain = () => {
    return (
      <audio
        ref={(audio) => (audioRef.current = audio)}
        style={{ width: "100%" }}
        controls
        autoPlay
      />
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "Main", render: renderMain }]}
    />
  );
}

class MediaPlayer {
  uuid: string;
  board: string;
  app: AppImpl;
  constructor(
    app: AppImpl,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async configure() {}

  async destroy() {}

  async process(params: any) {
    this.app.notify(this, { process: params });
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new MediaPlayer(app, board, descriptor, id) as any,
  createUI: MediaPlayerUI,
};

export default descriptor;
