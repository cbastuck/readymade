import UpdatesButton from "./UpdatesButton";
import NavigateButton from "../NavigateButton";

export default function WelcomePage() {
  return (
    <div className="fade-in" style={{ margin: "50px 0px" }}>
      <div style={{ margin: "5px 0px" }}>
        <UpdatesButton />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "5px",
          marginBottom: "15px",
        }}
      >
        <div
          className="hkp-fnt-label"
          style={{
            fontSize: "30px",
            marginLeft: "39%",
          }}
        >
          Welcome
        </div>
        <div style={{ marginLeft: "3px" }}>
          make{" "}
          <span
            style={{
              fontStyle: "normal",
              fontWeight: "bold",
              backgroundColor: "#454f6e",
              color: "white",
              paddingLeft: "5px",
              paddingRight: "5px",
              paddingTop: "5px",
            }}
          >
            it
          </span>{" "}
          yours
        </div>
      </div>

      <NavigateButton
        text="What is this?"
        width="180px"
        destination="/welcome/mission"
      />
    </div>
  );
}
