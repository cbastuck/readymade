import { CarouselItem } from ".";

type Props = {
  item: CarouselItem;
  index: number;
};

export default function SampleCarouselItem({ item, index }: Props) {
  return (
    <div className="flex items-start w-full h-full">
      <div
        className="rounded-xl bg-cover bg-no-repeat w-full h-full mx-2 md:mx-20 py-10 drop-shadow-xl overflow-auto hover:bg-gray-200 mb-6 overflow-hidden"
        style={{
          position: "relative",

          backgroundImage: item.background
            ? `url(${item.background})`
            : undefined,
        }}
      >
        <video
          id={`sample-video-${index}`}
          className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
          src={item.videoUrl}
          autoPlay={false}
          loop
          width={item.scale ? item.scale : "85%"}
          controls
        />
      </div>
    </div>
  );
}
