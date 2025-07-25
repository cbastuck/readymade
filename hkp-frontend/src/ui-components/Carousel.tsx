import { ReactNode } from "react";
import {
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
} from "hkp-frontend/src/ui-components/primitives/carousel";

import CarouselNav from "./CarouselNav";

type CarouselItemType = {
  value: { title: string };
  node: ReactNode;
};

type Props<T> = {
  items: Array<T>;
  current: number;
  onChange?: (index: number) => void;
  onClick?: (item: T) => void;
};

export default function Carousel<T extends CarouselItemType>({
  items,
  current,
  onChange,
  onClick,
}: Props<T>) {
  return (
    <CarouselCN className="w-full h-full">
      <CarouselContent>
        {items.map((item, index) => (
          <CarouselItem key={index}>{item.node}</CarouselItem>
        ))}
      </CarouselContent>
      <CarouselNav
        className="mt-8"
        items={items.map((item) => item.value.title)}
        current={current}
        onChange={onChange}
        onClick={() => onClick?.(items[current])}
      />
    </CarouselCN>
  );
}
