import { Component, ReactNode } from "react";

import BoardProvider from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "@/components/Footer.1";
import Breadcrumbs, { BreadcrumbItem } from "@/ui-components/Breadcrumbs";

type Props = {
  children: ReactNode[] | ReactNode;
  width?: string;
  title?: string;
  slug?: string;
  isRoot?: boolean;
  parent?: string;
};
export default class Template extends Component<Props> {
  render() {
    const { children, title, isRoot, parent, slug, width = "70%" } = this.props;
    const renderBreadcrumbs = (!!title || slug) && (!isRoot || !!parent);
    return (
      <BoardProvider user={null} availableRuntimes={[]} runtimeApis={{}}>
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: "100%",
          }}
        >
          <Toolbar showBoardActions={false} />
          <div
            style={{
              height: "100%",
              width,
              margin: "auto",
              marginTop: 20,
              marginBottom: 50,
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
            {renderBreadcrumbs && (
              <Breadcrumbs path={makeBreadcrumbsPath(title || slug!, parent)} />
            )}
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
          </div>
        </div>
        <Footer />
      </BoardProvider>
    );
  }
}

function makeBreadcrumbsPath(title: string, parent?: string) {
  const path: Array<BreadcrumbItem> = [
    {
      value: "Docs",
      link: "/docs",
    },
  ];

  if (parent) {
    path.push({
      value: parent,
    });
  }

  path.push({
    value: title,
    link: "#",
  });
  return path;
}
