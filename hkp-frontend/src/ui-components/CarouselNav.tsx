import {
  useCarousel,
  CarouselNext,
  CarouselPrevious,
} from "@/ui-components/primitives/carousel";

type Props = { items: string[] };

export default function CarouselNav(props: Props) {
  const { api } = useCarousel();
  const current = api?.selectedScrollSnap() || 0;
  return (
    <div className="justify-center flex gap-8 text-md font-serif w-full">
      <CarouselPrevious />
      <div style={{ marginTop: -10 }}>{props.items[current]}</div>
      <CarouselNext />
    </div>
  );
}
