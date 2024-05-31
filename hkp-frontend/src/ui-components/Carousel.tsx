import {
  useCarousel,
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";
import { ReactElement } from "react";

type Props = {
  items: Array<{ title: string; element: ReactElement }>;
};

export default function Carousel({ items }: Props) {
  return (
    <CarouselCN className="w-full h-full mt-10">
      <CarouselNav items={items.map((item) => item.title)} />
      <CarouselContent>
        {items.map((item, index) => (
          <CarouselItem key={index}>
            <div className="flex items-start h-full">
              <div className="rounded-xl bg-video-background7 bg-cover bg-no-repeat w-full mx-20 py-10 drop-shadow-2xl">
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
