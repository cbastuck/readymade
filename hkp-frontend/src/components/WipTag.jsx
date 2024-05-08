import { Icon } from "semantic-ui-react";

export default function WipTag() {
  return (
    <div style={{ transform: "scale(0.6 )", marginTop: -15 }}>
      <div stlye={{ display: "flex", flexDirection: "column" }}>
        <Icon name="tag" size="huge" color="blue" />
        <div
          className="font-sans text-xl"
          style={{
            position: "absolute",
            marginTop: -40,
            marginLeft: 19,
            transform: "rotate(45deg)",
            color: "white",
          }}
        >
          WIP
        </div>
      </div>
    </div>
  );
}
