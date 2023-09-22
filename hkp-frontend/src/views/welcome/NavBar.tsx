import { redirectTo } from "../../core/actions";

type Props = {
  pathname: string;
};

export default function NavBar({ pathname }: Props) {
  const pages = [
    "/welcome",
    "/welcome/mission",
    "/welcome/pitch",
    "/welcome/experiment",
  ];

  const renderBullet = (index: number, c: string) => (
    <span
      key={index}
      style={{ cursor: "pointer", padding: 5 }}
      onClick={() => redirectTo(`${pages[index]}#open`)}
    >
      {c}
    </span>
  );

  const currentIndex = pages.indexOf(pathname);
  if (currentIndex === 0) {
    return null;
  }

  return (
    <div
      style={{
        fontSize: 22,
        marginTop: 22,
      }}
    >
      {pages.map((_, idx) =>
        idx === currentIndex ? renderBullet(idx, "●") : renderBullet(idx, "￮")
      )}
    </div>
  );
}
