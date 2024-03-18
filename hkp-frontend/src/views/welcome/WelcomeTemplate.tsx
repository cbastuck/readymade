import { CSSProperties, ReactElement, useState } from "react";
import { Location } from "react-router-dom";

import BoardProvider from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";

import { withRouter } from "../../common";

import NavBar from "./NavBar";

import "./Welcome.css";

type Props = {
  height?: string;
  location: Location;
  children: ReactElement;
  pageStyle?: CSSProperties;
};

function Welcome({
  children,
  location,
  pageStyle = {},
  height = undefined,
}: Props) {
  const noAnim = location.hash === "#open";
  const [isClosed, setIsClosed] = useState(noAnim ? false : true);
  if (isClosed) {
    setTimeout(() => setIsClosed(false), 100);
  }

  const style: CSSProperties = isClosed
    ? { height: "0px", padding: "0px" }
    : pageStyle;

  if (height !== undefined) {
    style.height = height;
  }
  return (
    <BoardProvider user={null} isActionAvailable={() => false}>
      <div>
        <Toolbar />
        <div className={`hero-text fade-in-linear}`} style={style}>
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
