import { Icon } from "semantic-ui-react";

export default function WipTag() {
  return (
    <div style={{ transform: "scale(0.6 )", marginTop: -20 }}>
      <div stlye={{ display: "flex", flexDirection: "column" }}>
        <Icon name="tag" size="huge" color="blue" />
        <div
          style={{
            fontWeight: "bold",
            position: "absolute",
            marginTop: -40,
            marginLeft: 19,
            fontSize: 16,
            transform: "rotate(45deg)",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          WIP
        </div>
      </div>
    </div>
  );
}
