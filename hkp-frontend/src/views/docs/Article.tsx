import ChapterLink from "./ChapterLink";

import { detailStyle } from "./common";

type Props = {
  children: string | string[];
  to: string;
  separator?: string;
  details?: string;
};

export default function Article({
  children,
  to,
  separator = "",
  details = "",
}: Props) {
  return (
    <div>
      <div style={{ margin: "8px 0px" }}>
        <>
          {Array.isArray(to) ? (
            <>
              {to.map((dst, idx) => (
                <span key={`article-${dst}`}>
                  <ChapterLink to={dst} title={children[idx]} />
                  {idx < to.length - 1 ? <span>{separator}</span> : ""}
                </span>
              ))}
            </>
          ) : (
            <ChapterLink to={to} title={children as string} />
          )}
          {details && <span style={detailStyle}>[{details}]</span>}
        </>
      </div>
    </div>
  );
}
