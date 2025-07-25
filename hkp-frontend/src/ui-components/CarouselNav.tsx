import { useEffect } from "react";
import {
  useCarousel,
  CarouselNext,
  CarouselPrevious,
} from "hkp-frontend/src/ui-components/primitives/carousel";

type Props = {
  items: string[];
  current: number;
  className?: string;
  onChange?: (idx: number) => void;
  onClick: () => void;
};

export default function CarouselNav({
  items,
  current: passedCurrent,
  className = "",
  onChange,
  onClick,
}: Props) {
  const { api } = useCarousel();
  const current = api?.selectedScrollSnap() || 0;

  api?.on("select", () => onChange?.(api.selectedScrollSnap()));

  useEffect(() => api?.scrollTo(passedCurrent), [passedCurrent, api]);

  return (
    <div
      className={`justify-center flex gap-8 text-base font-serif w-full ${className}`}
    >
      <CarouselPrevious />
      <div
        className="w-[60%] text-center first-letter:uppercase hover:text-sky-600 h-min mt-[-10px] hover:underline"
        style={{ cursor: "pointer" }}
        onClick={onClick}
      >
        {items[current]}
        <div className="text-sky-600">Click to open on Playground</div>
      </div>
      <CarouselNext />
    </div>
  );
}
