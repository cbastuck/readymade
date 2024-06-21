import { useEffect } from "react";
import anime from "@/anime";
import Switcher from "@/components/Switcher";

type Props = {
  onComplete: () => void;
};

export default function LandingPitch({ onComplete }: Props) {
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
          inspiration? Or got annoyed when simply trying to connect{" "}
          <Switcher
            animate={true}
            style={{}}
            duration={8000}
            data={[
              "two devices?",
              "two standalone apps?",
              "a spreadsheet and a website?",
            ]}
            links={["#", "#", "#"]}
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
