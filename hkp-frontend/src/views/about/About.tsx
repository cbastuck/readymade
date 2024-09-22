import { Component } from "react";

import Toolbar from "../../components/Toolbar";
import Footer from "@/components/Footer";

import "./About.css";
import Faq from "../welcome/Faq";

type Props = {
  isCompact?: boolean;
};

export default class About extends Component<Props> {
  render() {
    return (
      <div className="">
        <Toolbar isCompact={!!this.props.isCompact} />
        <div className="flex flex-col">
          <h1 className="py-10 pt-4 md:pt-10 mx-0 mb-2 md:text-center">
            About
          </h1>
          <Faq />

          <div className="pb-10">
            <h1 className="py-4 pt-4 md:pt-10 mx-0 mb-2 md:text-center">
              Credits
            </h1>
            <div className="text-xl overflow-hidden tracking-widest text-justify mx-auto sm:w-[100%] md:w-[70%] gap-4">
              Using <a href="https://react.dev/">React</a>,{" "}
              <a href="https://microsoft.github.io/monaco-editor/">Monaco</a> as
              code editor,
              <a href="https://ui.shadcn.com">shadcn/ui</a>. Icons are from
              <a href="https://fontawesome.com/license/free"> Font Awesome </a>
              and <a href="https://lucide.dev/icons/bug-play">Lucide</a>. The
              fonts{" "}
              <a href="https://fonts.google.com/specimen/Special+Elite/about">
                Special Elite
              </a>
              , <a href="https://font.download/font/walkway">Walkway Black</a>,{" "}
              <a href="https://font.download/font/Cutive">Cutive</a>,{" "}
              <a href="https://fonts.google.com/specimen/Cabin">Cabin</a> and{" "}
              <a href="https://fonts.google.com/specimen/Lato">Lato</a> are used
              <div>
                Images and videos from the startpage come from{" "}
                <a href="https://www.pexels.com/de-de/@cottonbro/">
                  cottonbro studio
                </a>{" "}
                [
                <a href="https://www.pexels.com/video/person-using-a-tablet-5190552">
                  1
                </a>
                ,{" "}
                <a href="https://www.pexels.com/video/a-black-and-white-image-of-a-red-arrow-4965980">
                  2
                </a>
                ],{" "}
                <a href="https://www.pexels.com/video/a-monochromatic-video-of-clouds-of-paint-underwater-9707164">
                  Engin Akyurt
                </a>
                ,{" "}
                <a href="https://www.pexels.com/video/blue-food-coloring-mixing-with-liquid-3864191/">
                  StefWithAnF
                </a>
                ,{" "}
                <a href="https://www.pexels.com/video/best-free-glitch-effect-footage-noise-vhs-layer-tv-effects-16181150/">
                  Tanvir Shuvo
                </a>
                ,{" "}
                <a href="https://www.pexels.com/photo/abstract-painting-1495321">
                  Steve Johnson
                </a>
              </div>
            </div>
          </div>

          <div className="pb-10">
            <h1 className="py-4 pt-4 md:pt-10 mx-0 mb-2 md:text-center">
              Contact
            </h1>
            <div className="text-xl text-center">
              <a href="mailto:mail@hookup.to">mail@hookup.to</a>
            </div>
          </div>
        </div>

        <Footer isCompact={!!this.props.isCompact} />
      </div>
    );
  }
}
