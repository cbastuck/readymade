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
      <div className="m-4">
        <Toolbar isCompact={!!this.props.isCompact} />
        <div className="flex flex-col">
          <h1 className="py-10 pt-4 md:pt-10 mx-0 mb-2 md:text-center">
            About
          </h1>
          <div className="pb-2">
            <Faq />
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
