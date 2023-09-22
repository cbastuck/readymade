import { ReactElement } from "react";

import NavBar from "./NavBar";

export type Page = { p: string; r: ReactElement };

type Props = {
  page: string;
  pages: Array<Page>;
  visualisationFinished: boolean;
  onChangePage: (x: Page) => void;
};

export default function renderContent({
  page,
  pages,
  visualisationFinished,
  onChangePage,
}: Props) {
  const currentPage = pages.find((x) => x.p === page);
  return (
    <div
      style={{
        width: "100%",
        height: "95%",
        fontFamily: "Roboto",
        fontSize: 15,
      }}
    >
      {currentPage?.r || null}
      <NavBar
        page={page}
        pages={pages}
        visualisationFinished={visualisationFinished}
        onNavPage={onChangePage}
      />
    </div>
  );
}
