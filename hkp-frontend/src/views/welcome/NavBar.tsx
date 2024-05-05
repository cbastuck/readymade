import { useNavigate } from "react-router-dom";

type Props = {
  pathname: string;
};

export default function NavBar({ pathname }: Props) {
  const navigate = useNavigate();
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
      onClick={() => navigate(`${pages[index]}#open`)}
    >
      {c}
    </span>
  );

  const currentIndex = pages.indexOf(pathname);
  if (currentIndex === 0) {
    return null;
  }

  return (
    <div className="text-xl w-full">
      {pages.map((_, idx) =>
        idx === currentIndex ? renderBullet(idx, "●") : renderBullet(idx, "○")
      )}
    </div>
  );
}
