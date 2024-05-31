import {
  useCarousel,
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";
import { ReactElement } from "react";

export type CarouselItem = {
  title: string;
  element: ReactElement;
  background: string;
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
                className="rounded-xl bg-cover bg-no-repeat w-full mx-20 py-10 drop-shadow-2xl"
                style={{
                  cursor: item.onClick ? "pointer" : "default",
                  backgroundImage: `url(${item.background})`,
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

function CarouselNav(props: { items: string[] }) {
  const { api } = useCarousel();
  const current = api?.selectedScrollSnap() || 0;
  return (
    <div className="justify-center flex gap-8">
      <CarouselPrevious />
      <div style={{ marginTop: -10 }}>{props.items[current]}</div>
      <CarouselNext />
    </div>
  );
}
