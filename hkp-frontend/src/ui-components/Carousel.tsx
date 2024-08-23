import { ReactElement } from "react";
import {
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
} from "@/ui-components/primitives/carousel";
import { Button } from "@/ui-components/primitives/button";

import CarouselNav from "./CarouselNav";

export type CarouselItem = {
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
    for (let i = 0; i < vids.length; ++i) {
      if (i !== newItemIdx) {
        vids[i].pause();
        vids[i].currentTime = 0;
      }
      vids[newItemIdx].play();
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
                className="rounded-xl bg-cover bg-no-repeat w-full mx-2 md:mx-20 py-10 drop-shadow-xl overflow-auto hover:bg-gray-200 mb-6"
                style={{
                  position: "relative",
                  cursor: item.action ? "pointer" : "default",
                  backgroundImage: item.background
                    ? `url(${item.background})`
                    : undefined,
                }}
                onClick={() => onClick?.(item)}
              >
                <video
                  className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
                  src={item.videoUrl}
                  autoPlay={index === 0}
                  loop
                  width={item.scale ? item.scale : "85%"}
                />
                {item.action && (
                  <Button
                    className="w-full h-full hover:bg-[#22222270] bg-transparent text-center text-white hover:text-white text-2xl tracking-widest pt-[5%] opacity-0 hover:opacity-100"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transition: "opacity, background-color 0.5s ease-in-out",
                    }}
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
