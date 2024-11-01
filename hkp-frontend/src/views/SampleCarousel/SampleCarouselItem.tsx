import { CarouselItem } from ".";

type Props = {
  item: CarouselItem;
  index: number;
  background: string;
};

export default function SampleCarouselItem({ item, index, background }: Props) {
  return (
    <div className="flex items-start w-full h-full">
      <div
        className="rounded-xl bg-cover bg-no-repeat w-full h-full mx-2 md:mx-20 py-10 drop-shadow-xl overflow-auto mb-6 overflow-hidden"
        style={{
          position: "relative",
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
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
