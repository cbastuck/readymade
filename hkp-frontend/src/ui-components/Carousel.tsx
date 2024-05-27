import {
  Carousel as CarouselCN,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";
import { ReactElement } from "react";

type Props = {
  items: Array<ReactElement>;
};

export default function Carousel({ items }: Props) {
  return (
    <CarouselCN className="w-full h-full">
      <div className="mt-8 flex gap-4 justify-center"></div>
      <CarouselContent>
        {items.map((item, index) => (
          <CarouselItem key={index}>
            <div className="flex items-center justify-center h-full">
              <div className="rounded-xl bg-video-background7 bg-cover bg-no-repeat w-full mx-20 py-10 drop-shadow-2xl">
                {item}
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="justify-center flex mt-[100px] gap-8">
        <CarouselPrevious />
        <div>Example of a simplpe game with Hookup</div>
        <CarouselNext />
      </div>
    </CarouselCN>
  );
}
