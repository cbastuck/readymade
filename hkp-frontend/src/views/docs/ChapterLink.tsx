import { Link } from "react-router-dom";

type Props = {
  to: string;
  title: string;
};

export default function ChapterLink({ to, title }: Props) {
  return (
    <Link className="font-sans" to={to}>
      {title}
    </Link>
  );
}
