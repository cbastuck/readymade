import Carousel, { CarouselItem } from "@/ui-components/Carousel";
import { carouselItems } from "./Samples";
import { welcomeBlockClassname } from "../welcome/WelcomePanel";

type Props = {
  current: number;
  onCurrentChange: (index: number) => void;
  onLoad: (item: CarouselItem) => void;
};

export default function SampleBoards({
  current,
  onCurrentChange,
  onLoad,
}: Props) {
  return (
    <>
      <h1 id="samples" className="pt-4 md:pt-10 m-0 md:text-center">
        Sample Boards
      </h1>
      <div className={`py-10 ${welcomeBlockClassname}`}>
        Get a quick impression what this means by browsing through the samples.
        Maybe it is something you tried in the past as well? Every sample comes
        with a video with a link to the Playground, so can directly jump into
        the experience and try or tweak it yourself.
      </div>

      <div className="mx-auto px-[0%] lg:px-[10%] pb-14">
        <Carousel
          items={carouselItems}
          current={current}
          onChange={onCurrentChange}
          onClick={onLoad}
        />
        <div className={`pt-2 px-5 ${welcomeBlockClassname}`}>
          {carouselItems[current].description}
        </div>
      </div>
    </>
  );
}
