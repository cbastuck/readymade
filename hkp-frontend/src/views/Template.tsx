import { Component, ReactNode } from "react";

import BoardProvider from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import Breadcrumbs, {
  BreadcrumbItem,
} from "hkp-frontend/src/ui-components/Breadcrumbs";

type Props = {
  children: ReactNode[] | ReactNode;
  className?: string;
  width?: string;
  title?: string;
  slug?: string;
  isRoot?: boolean;
  parent?: string;
  compactToolbar?: boolean;
};
export default class Template extends Component<Props> {
  render() {
    const {
      children,
      title,
      isRoot,
      parent,
      slug,
      compactToolbar,
      width = "70%",
    } = this.props;
    const renderBreadcrumbs = (!!title || slug) && (!isRoot || !!parent);
    return (
      <BoardProvider user={null} availableRuntimeEngines={[]} runtimeApis={{}}>
        <div
          className="flex flex-col h-full w-full"
          style={{
            minHeight: "100%",
          }}
        >
          <Toolbar isCompact={compactToolbar} />
          <div
            style={{
              width,
              height: "100%",
              margin: "25px auto",
            }}
          >
            {renderBreadcrumbs && (
              <div className="pb-6">
                <Breadcrumbs
                  path={makeBreadcrumbsPath(title || slug!, parent)}
                />
              </div>
            )}
            <h1
              className="p-4"
              style={{
                width: "100%",
                textAlign: "center",
              }}
            >
              {title}
            </h1>

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
