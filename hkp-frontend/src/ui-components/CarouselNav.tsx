import {
  useCarousel,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";
import { useRef } from "react";

type Props = { items: string[]; onChange?: (idx: number) => void };

export default function CarouselNav(props: Props) {
  const { api } = useCarousel();
  const current = api?.selectedScrollSnap() || 0;
  const prevIdx = useRef<number>(current);
  if (prevIdx.current !== current) {
    prevIdx.current = current;
    setTimeout(() => props.onChange?.(current), 1);
  }

  return (
    <div className="justify-center flex gap-8 text-md font-serif w-full">
      <CarouselPrevious />
      <div className="w-[60%]" style={{ marginTop: -10 }}>
        {props.items[current]}
      </div>
      <CarouselNext />
    </div>
  );
}
