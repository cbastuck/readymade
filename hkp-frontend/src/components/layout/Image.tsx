type Props = {
  src?: string;
  alt: string;
  caption?: string;
  border?: boolean;
};

export default function Image({
  src,
  alt,
  caption = "",
  border = false,
}: Props) {
  if (!src) {
    return null;
  }
  return (
    <div style={{ width: "100%" }}>
      <img
        src={src}
        alt={alt}
        width="80%"
        style={{
          margin: "15px auto",
          display: "block",
          border: border ? "solid 1px lightgray" : undefined,
          padding: 5,
        }}
      />
      {caption && (
        <div
          className="font-sans tracking-wider text-md"
          style={{ width: "70%", margin: "auto", marginBottom: "30px" }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
