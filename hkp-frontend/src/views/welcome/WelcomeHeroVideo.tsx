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
  return <div style={videoStyle}>{children}</div>;
}
