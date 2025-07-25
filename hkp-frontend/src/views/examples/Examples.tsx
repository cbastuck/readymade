import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import CardContainer from "./CardContainer";
import Intro from "./Intro";

import Showcases from "./Showcases";
import Prototypes from "./Prototypes";
import examples from "./ExamplesData";
import Header from "./Header";

export default function Examples() {
  return (
    <div className="h-full flex flex-col w-full">
      <Toolbar />
      <div style={{ marginTop: 20, paddingBottom: 20 }}>
        <Header />
        <div style={{ margin: 20 }}>
          <Intro />
          <CardContainer examples={examples} />
          <Showcases />
          <Prototypes />
        </div>
      </div>
      <Footer />
    </div>
  );
}
