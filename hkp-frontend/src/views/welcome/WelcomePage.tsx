import UpdatesButton from "./UpdatesButton";
import NavigateButton from "../NavigateButton";

export default function WelcomePage() {
  return (
    <div className="fade-in" style={{ margin: "50px 0px", width: "100%" }}>
      <div style={{ margin: "0px 0px" }}>
        <UpdatesButton />
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="hkp-fnt-family" style={{ marginBottom: "5px" }}>
          <span style={{ fontSize: "35px", color: "#454f6e" }}>Welcome</span>
          <span style={{ marginLeft: "3px" }}>
            {" "}
            hook{" "}
            <span
              style={{
                fontStyle: "normal",
                fontWeight: "bold",
                backgroundColor: "#454f6e",
                color: "white",
                paddingLeft: "5px",
                paddingRight: "5px",
                paddingTop: "4px",
              }}
            >
              stuff
            </span>{" "}
            up{" "}
          </span>
        </div>
      </div>

      <NavigateButton
        text="What is this?"
        destination="/welcome/mission"
        style={{
          width: "280px",
          color: "#454f6e",
          fontSize: 14,
          border: "1px white",
        }}
      />
    </div>
  );
}
