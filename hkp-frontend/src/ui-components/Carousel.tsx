import { ReactElement } from "react";
import {
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
} from "@/ui-components/primitives/carousel";
import { Button } from "@/ui-components/primitives/button";

import CarouselNav from "./CarouselNav";

export type CarouselItem = {
  boardUrl: string;
  title: string;
  headline: string;
  description: string | ReactElement;
  videoUrl: string;
  background?: string;
  action?: {
    title: string;
    onClick?: { url: string };
  };
  scale?: string;
  createdAt?: string;
};

type Props = {
  items: Array<CarouselItem>;
  current: number;
  onChange?: (index: number) => void;
  onClick?: (item: CarouselItem) => void;
};

export default function Carousel({ items, current, onChange, onClick }: Props) {
  const onChangeInternal = (newItemIdx: number) => {
    const vids = document.getElementsByTagName("video");
    const currentVideoId = `sample-video-${newItemIdx}`;
    for (let i = 0; i < vids.length; ++i) {
      if (vids[i].id !== currentVideoId) {
        vids[i].pause();
        vids[i].currentTime = 0;
      } else {
        vids[i].play();
      }
    }
    onChange?.(newItemIdx);
  };
  return (
    <CarouselCN className="w-full h-full mt-10">
      <CarouselNav
        items={items.map((item) => item.title)}
        current={current}
        onChange={onChangeInternal}
      />
      <CarouselContent>
        {items.map((item, index) => (
          <CarouselItem key={index}>
            <div className="flex items-start w-full h-full">
              <div
                className="rounded-xl bg-cover bg-no-repeat w-full h-full mx-2 md:mx-20 py-10 drop-shadow-xl overflow-auto hover:bg-gray-200 mb-6 overflow-hidden"
                style={{
                  position: "relative",

                  backgroundImage: item.background
                    ? `url(${item.background})`
                    : undefined,
                }}
              >
                <video
                  id={`sample-video-${index}`}
                  className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
                  src={item.videoUrl}
                  autoPlay={index === 0}
                  loop
                  width={item.scale ? item.scale : "85%"}
                  controls
                />
                {item.action && (
                  <Button
                    className="hover:bg-gradient-to-t from-[#FFFF] to-[#000A] bg-transparent text-center text-white hover:text-white text-xl tracking-widest opacity-0 hover:opacity-70 rounded"
                    style={{
                      position: "absolute",
                      top: "6%",
                      left: "7%",
                      width: "86%",
                      height: "60%",
                      transition: "opacity, background-color 0.5s ease-in-out",
                      cursor: item.action ? "pointer" : "default",
                    }}
                    onClick={() => onClick?.(item)}
                  >
                    {item.action?.title}
                  </Button>
                )}
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </CarouselCN>
  );
}
