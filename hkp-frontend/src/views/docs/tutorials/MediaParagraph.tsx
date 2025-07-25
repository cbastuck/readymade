import Video from "hkp-frontend/src/components/layout/Video";

import { Link } from "react-router-dom";

type Props = {
  title: string;
  video: string;
  board?: { name: string; src: string };
  className?: string;
  children: React.ReactNode;
};

export default function MediaParagraph({
  className,
  title,
  video,
  board,
  children,
}: Props) {
  return (
    <div>
      <div className={`flex items-begin ${className}`}>
        <div className="w-full">
          <h3 className="m-0 p-0">{title}</h3>
          <div className="flex flex-col w-[40%] float-right">
            <Video className="p-2" src={video} width="95%" />
            {board && (
              <div className="text-center">
                <Link
                  to={`/playground/${board.name}?fromLink=${board.src}`}
                  target="_blank"
                >
                  Show it on Playground
                </Link>
              </div>
            )}
          </div>
          <div className="pt-[18px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
