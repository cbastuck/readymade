import ChapterLink from "./ChapterLink";

type Props = {
  children: string | string[];
  to: string;
  separator?: string;
  isRoot?: boolean;
};

export default function Article({
  children,
  to,
  separator = "",
  isRoot = false,
}: Props) {
  const classes = isRoot ? "text-xl" : "";
  return (
    <div className={classes}>
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
        </>
      </div>
    </div>
  );
}
