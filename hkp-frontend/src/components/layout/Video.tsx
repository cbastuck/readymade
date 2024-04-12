type Props = {
  src: string;
  caption?: string;
  anchor?: string;
};
export default function Video({ src, caption, anchor = "video" }: Props) {
  return (
    <div id={anchor} style={{ width: "100%", margin: "20px 0px" }}>
      <div style={{ margin: "auto", width: "80%" }}>
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
