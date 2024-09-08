import { ReactNode } from "react";
import { HeroVideoDescriptor } from "./heroVideos";

type Props = {
  value: HeroVideoDescriptor;
  children: ReactNode;
};

export function WelcomeHeroVideo({ value: video, children }: Props) {
  const videoStyle = {
    backgroundImage: `url(${video.url})`,
    backgroundSize: video.backgroundSize,
    backgroundPosition: video.backgroundPosition,
    backgroundAttachment: video.backgroundAttachment,
    backgroundRepeat: video.backgroundRepeat,
  };
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        zIndex: 1,
        overflowY: "hidden",
      }}
    >
      {children}

      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          zIndex: -1,
        }}
      >
        <video className="w-full h-full object-cover" autoPlay loop muted>
          <source src={video.url} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
