import Video from "@/components/layout/Video";
import { Link } from "react-router-dom";

type Props = {
  video: string;
  board?: { name: string; src: string };
  className?: string;
  children: React.ReactNode;
};

export default function MediaParagraph({
  className,
  video,
  board,
  children,
}: Props) {
  return (
    <div className={`py-2 ${className}`}>
      {children}
      <Video src={video} />
      {board && (
        <Link
          to={`/playground/${board.name}?fromLink=${board.src}`}
          target="_blank"
        >
          Example Board
        </Link>
      )}
    </div>
  );
}
