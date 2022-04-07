import React, { Component } from "react";

import { AppConsumer } from "../AppContext";
import BoardContext, { BoardConsumer } from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "../components/Footer";
import ServiceReference from "../components/ServiceReference";
import { withRouter } from "../common";

class ServiceReferenceView extends Component {
  getService = () => {
    const { match } = this.props;
    const { params } = match || {};
    const { service } = params || {};
    return service;
  };

  render() {
    const service = this.getService();
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardContext>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
              }}
            >
              <BoardConsumer>
                {(boardContext) => (
                  <div style={{ height: "100%" }}>
                    <Toolbar onAction={boardContext.onAction} />
                    <div
                      style={{
                        height: "100%",
                        width: "80%",
                        margin: "auto",
                        marginTop: 30,
                      }}
                    >
                      <ServiceReference service={service} />
                    </div>
                  </div>
                )}
              </BoardConsumer>
              <Footer flex />
            </div>
          </BoardContext>
        )}
      </AppConsumer>
    );
  }
}

export default withRouter(ServiceReferenceView);
