import { Component, ReactNode } from "react";

import BoardProvider from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "@/components/Footer";
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
      <BoardProvider user={null} availableRuntimeEngines={[]} runtimeApis={{}}>
        <div
          className="flex flex-col h-full w-full"
          style={{
            minHeight: "100%",
          }}
        >
          <Toolbar />
          <div
            style={{
              height: "100%",
              width,
              margin: "25px auto",
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
              className="font-serif"
              style={{
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
