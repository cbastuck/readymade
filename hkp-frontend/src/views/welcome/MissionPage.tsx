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
          <div
            key={xi}
            style={{
              textAlign: "center",
              display: "table-row",
            }}
          >
            <div
              style={{
                display: "table-cell",
                verticalAlign: "middle",
                textAlign: "center",
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily: "Lato",
              }}
              className={`fade-in-${xi}`}
            >
              {x.q && (
                <h1 style={{ fontSize: 19, color: "454f6d", paddingBottom: 5 }}>
                  <Link to={x.href} style={{ fontSize: 17 }}>
                    {x.q}
                  </Link>
                </h1>
              )}
              <div
                className="home-title"
                style={{
                  paddingTop: 2,
                  paddingLeft: 2,
                  fontSize: 18,
                  color: "#777",
                  textTransform: "none",
                  fontFamily: "roboto",
                  letterSpacing: 2,
                }}
              >
                {x.a}
                {x.href && (
                  <Link
                    to={x.href}
                    style={{
                      fontSize: 11,
                      textTransform: "capitalize",
                      fontFamily: "Lato",
                      paddingLeft: 3,
                    }}
                  >
                    {" show more"}
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
