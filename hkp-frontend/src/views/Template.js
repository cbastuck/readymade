import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Container, Breadcrumb } from "semantic-ui-react";

import { AppConsumer } from "../AppContext";
import BoardContext, { BoardConsumer } from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "../components/Footer";

export default class Template extends Component {
  renderBreadcrumbs = (title, isRoot) => {
    const breadcrumpStyle = {
      letterSpacing: 1,
      textTransform: "uppercase",
      fontSize: 11,
    };
    if (isRoot) {
      return false;
    }
    return (
      <div
        style={{
          textAlign: "left",
          marginTop: 15,
          width: 300,
        }}
      >
        <Breadcrumb>
          <Breadcrumb.Section link>
            <Link to="/docs">
              <span style={breadcrumpStyle}>Docs</span>
            </Link>
          </Breadcrumb.Section>
          <Breadcrumb.Divider />
          <Breadcrumb.Section link>
            <span style={breadcrumpStyle}>{title}</span>
          </Breadcrumb.Section>
        </Breadcrumb>
      </div>
    );
  };

  render() {
    const { children, title, isRoot } = this.props;
    const renderBreadcrumbs = !!title;
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardContext>
            <BoardConsumer>
              {(boardContext) => (
                <div style={{ minHeight: "100%" }}>
                  <Toolbar />
                  <Container
                    style={{
                      marginTop: 20,
                      marginBottom: 50,
                      width: "70%",
                      height: "100%",
                    }}
                  >
                    <h1
                      style={{
                        width: "100%",
                        fontSize: 20,
                        textAlign: "center",
                        letterSpacing: 8,
                        textTransform: "uppercase",
                        margin: 0,
                      }}
                    >
                      {title}
                    </h1>
                    {renderBreadcrumbs && this.renderBreadcrumbs(title, isRoot)}
                    {children}
                  </Container>
                </div>
              )}
            </BoardConsumer>
            <div style={{ height: 5 }} />
            <Footer />
          </BoardContext>
        )}
      </AppConsumer>
    );
  }
}
