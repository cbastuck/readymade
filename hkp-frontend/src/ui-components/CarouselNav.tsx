import { useEffect } from "react";
import {
  useCarousel,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";
import Button from "./Button";

type Props = {
  items: string[];
  current: number;
  onChange?: (idx: number) => void;
  onClick: () => void;
};

export default function CarouselNav({
  items,
  current: passedCurrent,
  onChange,
  onClick,
}: Props) {
  const { api } = useCarousel();
  const current = api?.selectedScrollSnap() || 0;

  api?.on("select", () => onChange?.(api.selectedScrollSnap()));

  useEffect(() => api?.scrollTo(passedCurrent), [passedCurrent]);

  return (
    <div className="justify-center flex gap-8 text-md font-serif w-full">
      <CarouselPrevious />
      <Button
        className="w-[60%] text-center first-letter:uppercase hover:text-sky-600 h-2 mt-[-8px]"
        style={{ cursor: "pointer" }}
        onClick={onClick}
        variant="ghost"
      >
        {items[current]}
      </Button>
      <CarouselNext />
    </div>
  );
}
