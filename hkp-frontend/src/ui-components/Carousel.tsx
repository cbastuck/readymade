import {
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
} from "@/ui-components/primitives/carousel";
import { ReactElement } from "react";

import CarouselNav from "./CarouselNav";

export type CarouselItem = {
  title: string;
  element: ReactElement;
  background?: string;
  onClick?: () => void;
};

type Props = {
  items: Array<CarouselItem>;
};

export default function Carousel({ items }: Props) {
  return (
    <CarouselCN className="w-full h-full mt-10">
      <CarouselNav items={items.map((item) => item.title)} />
      <CarouselContent>
        {items.map((item, index) => (
          <CarouselItem key={index}>
            <div className="flex items-start h-full" onClick={item.onClick}>
              <div
                className="rounded-xl bg-cover bg-no-repeat w-full mx-20 py-10 drop-shadow-2xl overflow-auto"
                style={{
                  cursor: item.onClick ? "pointer" : "default",
                  backgroundImage: item.background
                    ? `url(${item.background})`
                    : undefined,
                }}
              >
                {item.element}
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </CarouselCN>
  );
}
