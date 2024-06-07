type Props = {
  text: string;
  active?: boolean;
};

export default function LoadIndicator({ active = true, text }: Props) {
  const css = `  
  @keyframes dot {
    0% { background-color: grey; transform: scale(1); }
    50% { background-color: rgb(2, 132, 199); transform: scale(1.3); }
    100% { background-color: grey; transform: scale(1); }
  }`;

  const dotSize = 10;
  const loadingDotStyle = {
    animation: "dot ease-in-out 1s infinite",
    backgroundColor: "grey",
    display: "inline-block",
    margin: "6px",
    height: dotSize,
    width: dotSize,
    borderRadius: "50%",
  };
  if (!active) {
    return null;
  }
  return (
    <>
      <style>{css}</style>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          height: "100%",
          position: "fixed",
          width: "100%",
        }}
      >
        <span style={loadingDotStyle}></span>
        <span style={{ ...loadingDotStyle, animationDelay: "0.2s" }}></span>
        <span style={{ ...loadingDotStyle, animationDelay: "0.3s" }}></span>
        <div className="m-2 cursor-default">{text}</div>
      </div>
    </>
  );
}
