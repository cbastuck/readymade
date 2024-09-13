import { ReactNode } from "react";
import { HeroVideoDescriptor } from "./heroVideos";

type Props = {
  value: HeroVideoDescriptor;
  children: ReactNode;
};

export function WelcomeHeroVideo({ value, children }: Props) {
  const imageStyle =
    value.type === "image"
      ? {
          backgroundImage: `url(${value.url})`,
          backgroundSize: value.backgroundSize,
          backgroundPosition: value.backgroundPosition,
          backgroundRepeat: value.backgroundRepeat,
          backgroundAttachment: "fixed",
        }
      : {};
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        zIndex: 1,
        overflowY: "hidden",
        ...imageStyle,
      }}
    >
      {children}
      {value.type === "video" && (
        <div
          className="w-full h-full"
          style={{
            position: "absolute",
            top: 0,
            zIndex: -1,
          }}
        >
          <video
            className="w-full h-full object-cover"
            autoPlay
            loop={value.loop}
            muted
            playsInline
          >
            <source src={value.url} type="video/mp4" />
          </video>
        </div>
      )}
    </div>
  );
}
