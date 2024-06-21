import { useEffect } from "react";
import anime from "@/anime";
import Switcher from "@/components/Switcher";

export type LandingPitchUsecase = { text: string; link: string };
type Props = {
  usecases: Array<LandingPitchUsecase>;
  onComplete: () => void;
  onLink: (idx: number) => void;
};

export default function LandingPitch({ usecases, onComplete, onLink }: Props) {
  useEffect(() => {
    const initialDelay = 4000;
    anime({
      targets: document.querySelectorAll("#pitch-points .pitch-item"),
      loop: false,
      direction: "forward",
      translateY: [1000, 0],
      easing: "easeInOutSine",
      duration: 1000,
      delay: (_el: any, i: number) => {
        if (i === 0) {
          return initialDelay;
        }
        return i * 1000 + initialDelay;
      },
      complete: onComplete,
    });
  }, []);
  return (
    <div
      id="pitch-points"
      className="flex flex-col mb-10 text-xl overflow-hidden tracking-widest text-justify  mx-auto sm:w-[100%] md:w-[80%] gap-4"
    >
      <div className="pitch-item">
        <div>
          Have you ever felt creative, but the setup process killed your
          inspiration? Or got annoyed while "simply" trying to{" "}
          <Switcher
            animate={true}
            style={{}}
            duration={8000}
            data={usecases.map(({ text }) => text)}
            links={usecases.map(({ link }) => link)}
            onLink={onLink}
          />
        </div>
      </div>
      <div className="pitch-item">
        Imagine focusing on your ideas and the output instead of managing the
        technical setup.
      </div>
      <div className="pitch-item">
        Try Hookit and build ideas with data seamlessly flowing through reusable
        building blocks. It is <span className="underline">your</span> choice.
      </div>
    </div>
  );
}
