import { Component, CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container, Breadcrumb, Button } from "semantic-ui-react";

import { AppConsumer } from "../AppContext";
import BoardProvider, { BoardConsumer } from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "../components/Footer";

type Props = {
  children: JSX.Element[] | JSX.Element;
  title: string;
  isRoot?: boolean;
  parent?: string;
};
export default class Template extends Component<Props> {
  // TODO: these breadcrumps are taylored to the docs views
  // make this component more generic - also used in Profile
  renderBreadcrumbs = (title: string, parent?: string) => {
    const breadcrumpStyle: CSSProperties = {
      letterSpacing: 1,
      fontSize: 12,
    };
    return (
      <div
        className="hkp-fnt-label"
        style={{
          textAlign: "left",
          marginTop: 15,
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
          <BoardProvider isActionAvailable={() => false}>
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
                        fontSize: 24,
                        textAlign: "center",
                        letterSpacing: 6,
                        padding: "5px 0px",
                      }}
                      className="hkp-fnt-label"
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
          </BoardProvider>
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
        className="hkp-fnt-label"
        style={{
          fontSize: 14,
          border: "1px solid darkgray",
          color: "white",
          backgroundColor: "#454f6d",
        }}
        onClick={() => navigate(to)}
      >
        {label ? label : "Next"}
      </Button>
    </div>
  );
}
