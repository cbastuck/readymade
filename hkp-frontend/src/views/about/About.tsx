import { Component } from "react";

import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";

import "./About.css";
import Faq from "../welcome/Faq";
import Mission from "./Mission";
import Credits from "./Credits";
import Contact from "./Contact";

type Props = {
  isCompact?: boolean;
};

export default class About extends Component<Props> {
  render() {
    return (
      <div className="flex flex-col h-full w-full">
        <Toolbar isCompact={!!this.props.isCompact} />
        <div className="flex flex-col sm:w-[100%] md:w-[60%] mx-auto px-8">
          <h1 className="pb-4 pt-4 md:pt-10 mx-0 mb-2 md:text-center">About</h1>
          <Mission />
          <Faq />
          <Credits />
          <Contact />
          <Footer isCompact={!!this.props.isCompact} />
        </div>
      </div>
    );
  }
}
