import { CSSProperties, ReactElement, useState } from "react";
import { Location } from "react-router-dom";

import BoardProvider from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";

import { withRouter } from "../../common";

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
        <Toolbar isCompact={false} />
        <div className="h-full w-full" style={style}>
          {children}
        </div>
        <Footer />
      </div>
    </BoardProvider>
  );
}

const WelcomeWithRouter = withRouter(Welcome);
export default WelcomeWithRouter;
