import Template from "../../Template";
import RuntimeBlock from "./RuntimeBlock";

export default function BoardBlock() {
  return (
    <Template title="Board">
      <div
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <div
          style={{
            marginTop: 20,
            marginRight: 30,
            width: 300,
            padding: 5,
          }}
        >
          <RuntimeBlock runtimeName="Runtime A" />
          <div />
          <RuntimeBlock runtimeName="Runtime B" />
        </div>
      </div>
    </Template>
  );
}
