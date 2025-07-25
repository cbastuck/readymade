import Carousel from "hkp-frontend/src/ui-components/Carousel";
import { carouselItems } from "./Samples";
import { welcomeBlockClassname } from "../welcome/WelcomePanel";
import SampleCarouselItem from "./SampleCarouselItem";
import { ReactElement, useMemo } from "react";

export type CarouselItem = {
  boardUrl: string;
  title: string;
  headline: string;
  description: string | ReactElement;
  videoUrl: string;
  action?: {
    title: string;
    onClick?: { url: string };
  };
  scale?: string;
  createdAt?: string;
};

type Props = {
  current: number;
  background: string;
  onCurrentChange: (index: number) => void;
  onLoad: (item: CarouselItem) => void;
};

export default function SampleCarousel({
  current,
  background,
  onCurrentChange,
  onLoad,
}: Props) {
  const items = useMemo(
    () =>
      carouselItems.map((item, index) => ({
        value: item,
        node: (
          <SampleCarouselItem
            item={item}
            index={index}
            background={background}
          />
        ),
      })),
    [background]
  );

  const onChangeInternal = (newItemIdx: number) => {
    const vids = document.getElementsByTagName("video");
    const currentVideoId = `sample-video-${newItemIdx}`;
    for (let i = 0; i < vids.length; ++i) {
      if (vids[i].id?.startsWith("sample-video-")) {
        if (vids[i].id !== currentVideoId) {
          vids[i].pause();
          vids[i].currentTime = 0;
        } else {
          // vids[i].play();
        }
      }
    }
    onCurrentChange?.(newItemIdx);
  };

  return (
    <>
      <div className={`py-10 ${welcomeBlockClassname}`}>
        Get a quick impression by browsing through the samples below. Every
        sample comes with a video and a link to a Playground board. Click on the
        headline to jump into the experience and try it for yourself.
      </div>

      <div className="mx-auto px-[0%] lg:px-[10%] pb-14">
        <Carousel
          items={items}
          current={current}
          onChange={onChangeInternal}
          onClick={(item) => onLoad(item.value)}
        />
        <div className={`pt-6 px-5 ${welcomeBlockClassname}`}>
          {carouselItems[current].description}
        </div>
      </div>
    </>
  );
}
