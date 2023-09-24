import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";

import CardContainer from "./CardContainer";

import Disclaimer from "./Disclaimer";
import Headline from "./Headline";

import { s, t } from "../../styles";

import Showcases from "./Showcases";
import Prototypes from "./Prototypes";

import examples from "./ExamplesData";
import Header from "./Header";

export default function Examples() {
  return (
    <div
      style={s(t.h100, {
        fontFamily: "Roboto",
        display: "flex",
        flexDirection: "column",
      })}
    >
      <Toolbar />
      <div style={{ marginTop: 20 }}>
        <Header />
        <div style={{ margin: 40 }}>
          <Headline>Basic</Headline>
          <Disclaimer />
          <CardContainer examples={examples} />
          <Showcases />
          <Prototypes />
        </div>
      </div>

      <Footer />
    </div>
  );
}
