import {
  useCarousel,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";
import { useEffect, useRef } from "react";

type Props = {
  items: string[];
  current: number;
  onChange?: (idx: number) => void;
};

export default function CarouselNav({
  items,
  current: passedCurrent,
  onChange,
}: Props) {
  const { api } = useCarousel();
  const current = api?.selectedScrollSnap() || 0;
  const prevIdx = useRef<number>(current);
  if (prevIdx.current !== current) {
    prevIdx.current = current;
    setTimeout(() => onChange?.(current), 1);
  }

  useEffect(() => api?.scrollTo(passedCurrent), [passedCurrent]);

  return (
    <div className="justify-center flex gap-8 text-md font-serif w-full">
      <CarouselPrevious />
      <div
        className="w-[60%] text-center first-letter:uppercase"
        style={{ marginTop: -10 }}
      >
        {items[current]}
      </div>
      <CarouselNext />
    </div>
  );
}
