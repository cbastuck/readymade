import { Link } from "react-router-dom";
import NavigateButton from "../NavigateButton";

export default function MissionPage() {
  return (
    <div
      className="fade-in-linear-slow"
      style={{ width: "100%", height: "100%" }}
    >
      <div
        style={{
          height: "100%",
          width: "80%",
          marginLeft: "10%",
          display: "table",
          tableLayout: "fixed",
        }}
      >
        {[
          {
            q: "What",
            a: "An attempt to lower access barriers and play with technology",
            href: "/docs/pitch/what",
          },
          {
            q: "Why",
            a: "Technology is an enabler for creativity, inspiration and thinking",
            href: "/docs/pitch/why",
          },
          {
            q: "How",
            a: "Build abstractions that seamlessly connect data, logic, devices and services",
            href: "/docs/pitch/how",
          },
          {
            a: (
              <NavigateButton destination="/welcome/pitch" text="Quick Pitch" />
            ),
          },
        ].map((x, xi) => (
          <div key={xi} className="m-5" style={{ textAlign: "center" }}>
            <div style={{ textAlign: "center" }} className={`fade-in-${xi}`}>
              {x.q && (
                <h1 style={{ color: "454f6d", paddingBottom: 5 }}>
                  <Link to={x.href}>{x.q}</Link>
                </h1>
              )}
              <div
                className="home-title text-lg font-serif-wet my-4"
                style={{
                  paddingLeft: 2,
                  color: "#777",
                  textTransform: "none",
                  letterSpacing: 2,
                }}
              >
                {x.a}
                {x.href && (
                  <Link
                    to={x.href}
                    style={{
                      fontSize: 12,
                      paddingLeft: 3,
                    }}
                  >
                    {" more"}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
