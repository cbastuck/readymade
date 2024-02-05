import { ReactElement, useState } from "react";
import { Location } from "react-router-dom";

import BoardProvider from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";

import { withRouter } from "../../common";

import BackgroundImage from "./BackgroundImage";
import NavBar from "./NavBar";

import "./Welcome.css";

type Props = {
  location: Location;
  children: ReactElement;
  pageStyle?: object;
};

function Welcome({ children, location, pageStyle }: Props) {
  const noAnim = location.hash === "#open";
  const [isClosed, setIsClosed] = useState(noAnim ? false : true);
  if (isClosed) {
    setTimeout(() => setIsClosed(false), 100);
  }

  return (
    <BoardProvider user={null} isActionAvailable={() => false}>
      <div>
        <Toolbar />
        <div
          className={`hero-text fade-in-linear}`}
          style={isClosed ? { height: "0px", padding: "0px" } : pageStyle}
        >
          <div
            className="hkp-fnt-color"
            style={{
              width: "100%",
              height: "95%",
              fontSize: 15,
            }}
          >
            {children}
            <div className="fade-in-linear">
              <NavBar pathname={location.pathname} />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </BoardProvider>
  );
}

export default withRouter(Welcome);
