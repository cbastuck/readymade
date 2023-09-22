import { Page } from "./PageContainer";

type Props = {
  page: string;
  pages: Array<Page>;
  visualisationFinished: boolean;
  onNavPage: (x: Page) => void;
};

export default function NavBar({
  page,
  pages,
  visualisationFinished,
  onNavPage,
}: Props) {
  if (page === pages[0].p || visualisationFinished) {
    return false;
  }
  const renderBullet = (x: Page, c: string) => (
    <span
      key={x.p}
      style={{ cursor: "pointer", padding: 5 }}
      onClick={() => onNavPage(x)}
    >
      {c}
    </span>
  );
  return (
    <div
      style={{
        fontSize: 22,
        marginTop: 20,
      }}
    >
      {pages.map((x) =>
        x.p === page ? renderBullet(x, "●") : renderBullet(x, "￮")
      )}
    </div>
  );
}
