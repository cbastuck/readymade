import {
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
} from "@/ui-components/primitives/carousel";
import { ReactElement } from "react";

import CarouselNav from "./CarouselNav";
import Button from "./Button";

export type CarouselItem = {
  title: string;
  description: string;
  element: ReactElement;
  background?: string;
  action?: {
    title: string;
    onClick?: () => void;
  };
};

type Props = {
  items: Array<CarouselItem>;
  onChange?: (index: number) => void;
};

export default function Carousel({ items, onChange }: Props) {
  return (
    <CarouselCN className="w-full h-full mt-10">
      <CarouselNav
        items={items.map((item) => item.title)}
        onChange={onChange}
      />
      <CarouselContent>
        {items.map((item, index) => (
          <CarouselItem key={index}>
            <div className="flex items-start h-full">
              <div
                className="rounded-xl bg-cover bg-no-repeat w-full mx-2 md:mx-20 py-10 drop-shadow-2xl overflow-auto hover:bg-gray-200"
                style={{
                  position: "relative",
                  cursor: item.action ? "pointer" : "default",
                  backgroundImage: item.background
                    ? `url(${item.background})`
                    : undefined,
                }}
                onClick={item.action?.onClick}
              >
                {item.element}
                {item.action && (
                  <Button
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transition: "opacity, background-color 0.5s ease-in-out",
                    }}
                    className="w-full h-full hover:bg-[#22222270] bg-transparent text-center text-white hover:text-white text-2xl tracking-widest pt-[5%] opacity-0 hover:opacity-100"
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
