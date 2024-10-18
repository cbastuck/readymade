type Props = {
  className?: string;
  src: string;
  caption?: string;
  anchor?: string;
  width?: string;
};
export default function Video({
  src,
  caption,
  anchor = "video",
  className = "my-[20px] mx-0",
  width = "80%",
}: Props) {
  return (
    <div className={className} id={anchor} style={{ width: "100%" }}>
      <div style={{ margin: "auto", width }}>
        <video src={src} width="100%" controls />
        {caption && (
          <div className="font-sans" style={{ textAlign: "center" }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
