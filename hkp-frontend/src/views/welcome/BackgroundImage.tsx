import HkpBraidLogo from "./hkp-dots-braid.svg?react";

export default function BackgroundImage() {
  return (
    <div
      style={{
        position: "absolute",
        height: "100%",
        width: "100%",
        zIndex: -100,
        overflowY: "hidden",
      }}
      className="fade-in-linear-slow"
    >
      <div style={{ height: "200%", width: "250%", marginLeft: "0%" }}>
        <HkpBraidLogo />
      </div>
    </div>
  );
}
