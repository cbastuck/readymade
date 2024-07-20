import { useEffect } from "react";
import anime from "@/anime";
import Switcher from "@/components/Switcher";

export type LandingPitchUsecase = { headline?: string };
type Props = {
  usecases: Array<LandingPitchUsecase>;
  switchUsecaseInterval: number;
  onComplete: () => void;
  onLink: (idx: number) => void;
};

export default function LandingPitch({
  usecases,
  switchUsecaseInterval,
  onComplete,
  onLink,
}: Props) {
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
      className="flex flex-col mb-10 text-xl overflow-hidden tracking-widest text-justify  mx-auto sm:w-[100%] md:w-[70%] gap-4"
    >
      <div className="pitch-item">
        <div className="text-left">
          Do you sometimes feel creative, but the setup process destroys your
          inspiration? Or you loose interest while trying to "just"{" "}
          <Switcher
            animate={true}
            style={{}}
            duration={switchUsecaseInterval}
            data={usecases.map(({ headline }) => headline || "")}
            onLink={onLink}
          />
        </div>
      </div>
      <div className="pitch-item">
        Imagine focusing on your ideas and the output instead of managing the
        technical setup.
      </div>
      <div className="pitch-item">
        Try building your ideas with data seamlessly flowing through reusable
        building blocks. It's what you make of it.
      </div>
    </div>
  );
}
