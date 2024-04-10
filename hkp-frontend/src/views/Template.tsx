import { Component, CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Container, Breadcrumb } from "semantic-ui-react";

import BoardProvider from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "../components/Footer";

type Props = {
  children: ReactNode[] | ReactNode;
  width?: string;
  title?: string;
  slug?: string;
  isRoot?: boolean;
  parent?: string;
};
export default class Template extends Component<Props> {
  // TODO: these breadcrumps are taylored to the docs views
  // make this component more generic - also used in Profile
  renderBreadcrumbs = (title?: string, parent?: string) => {
    const breadcrumpStyle: CSSProperties = {
      letterSpacing: 1,
      fontSize: 12,
      textTransform: "capitalize",
    };
    return (
      <div
        className=""
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
            <span style={breadcrumpStyle}>{title || "missing"}</span>
          </Breadcrumb.Section>
        </Breadcrumb>
      </div>
    );
  };

  render() {
    const { children, title, isRoot, parent, slug, width = "70%" } = this.props;
    const renderBreadcrumbs = (!!title || slug) && (!isRoot || !!parent);
    return (
      <BoardProvider
        user={null}
        boardName="template"
        availableRuntimes={[]}
        runtimeApis={{}}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: "100%",
            margin: "auto",
          }}
        >
          <Toolbar showBoardActions={false} />
          <Container
            style={{
              marginTop: 20,
              marginBottom: 50,
              width,
              height: "100%",
            }}
          >
            <h1
              style={{
                width: "100%",
                textAlign: "center",
                padding: "5px 0px",
              }}
            >
              {title}
            </h1>
            {renderBreadcrumbs && this.renderBreadcrumbs(title || slug, parent)}
            <div
              className="font-serif-wet tracking-widest"
              style={{
                lineHeight: 1.6,
                paddingBottom: "30px",
                width: "100%",
              }}
            >
              {children}
            </div>
          </Container>
        </div>
        <Footer />
      </BoardProvider>
    );
  }
}
