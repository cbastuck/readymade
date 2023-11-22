import React, { Component } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container, Breadcrumb, Button } from "semantic-ui-react";

import { AppConsumer } from "../AppContext";
import BoardContext, { BoardConsumer } from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "../components/Footer";

type Props = {
  children: JSX.Element;
  title: string;
  isRoot: boolean;
  parent?: string;
};
export default class Template extends Component<Props> {
  // TODO: these breadcrumps are taylored to the docs views
  // make this component more generic - also used in Profile
  renderBreadcrumbs = (title: string, parent?: string) => {
    const breadcrumpStyle: any = {
      letterSpacing: 1,
      textTransform: "uppercase",
      fontSize: 11,
    };
    return (
      <div
        style={{
          textAlign: "left",
          marginTop: 15,
          width: 300,
        }}
      >
        <Breadcrumb>
          <Breadcrumb.Section>
            <Link to="/docs">
              <span style={breadcrumpStyle}>Docs</span>
            </Link>
          </Breadcrumb.Section>
          <Breadcrumb.Divider />
          {parent && (
            <>
              <Breadcrumb.Section>
                <span style={breadcrumpStyle}>{parent}</span>
              </Breadcrumb.Section>
              <Breadcrumb.Divider />
            </>
          )}
          <Breadcrumb.Section link>
            <span style={breadcrumpStyle}>{title}</span>
          </Breadcrumb.Section>
        </Breadcrumb>
      </div>
    );
  };

  render() {
    const { children, title, isRoot, parent } = this.props;
    const renderBreadcrumbs = !!title && (!isRoot || !!parent);
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardContext isActionAvailable={() => false}>
            <BoardConsumer>
              {(boardContext) => (
                <div
                  style={{ width: "100%", height: "100%", minHeight: "100%" }}
                >
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
                        padding: "20px 0px",
                      }}
                    >
                      {title}
                    </h1>
                    {renderBreadcrumbs && this.renderBreadcrumbs(title, parent)}
                    {children}
                    <div style={{ height: 10 }} />
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

type NavButtonProps = {
  to: string;
  label: string;
};
export function NavigateButton({ to, label }: NavButtonProps) {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center", width: "100%", margin: "10px 0px" }}>
      <Button
        style={{
          textTransform: "uppercase",
          fontSize: 12,
          border: "1px solid darkgray",
          color: "white",
          backgroundColor: "#454f6d",
        }}
        onClick={() => navigate(to)}
      >
        {label ? label : "Next"}
      </Button>
      <div style={{ height: 10 }} />
    </div>
  );
}
