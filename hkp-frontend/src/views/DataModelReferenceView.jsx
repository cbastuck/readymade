import { Component } from "react";

import BoardProvider from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";

import { withRouter } from "../common";
import DataModelReference from "../components/DataModelReference";

class DataModelReferenceView extends Component {
  render() {
    const { match } = this.props;
    const { params } = match || {};
    const { name } = params || {};
    return (
      <BoardProvider>
        <div style={{ height: "100%" }}>
          <Toolbar />
          <div style={{ marginTop: 20, padding: 10 }}>
            <DataModelReference datamodel={name} name={name} />
          </div>
        </div>
        <Footer />
      </BoardProvider>
    );
  }
}

export default withRouter(DataModelReferenceView);
