import { ReactElement, useState } from "react";
import { Location } from "react-router-dom";

import BoardContext from "../../BoardContext";
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
    <BoardContext user={null}>
      <div>
        <BackgroundImage />
        <Toolbar />
        <div
          className={`hero-text fade-in-linear}`}
          style={isClosed ? { height: "0px", padding: "0px" } : pageStyle}
        >
          <div
            style={{
              width: "100%",
              height: "95%",
              fontFamily: "Roboto",
              fontSize: 15,
            }}
          >
            {children}
            <div className="fade-in-linear-slow">
              <NavBar pathname={location.pathname} />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </BoardContext>
  );
}

export default withRouter(Welcome);
