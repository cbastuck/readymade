import { Link } from "react-router-dom";
import NavigateButton from "../NavigateButton";

export default function MissionPage() {
  return (
    <div className="fade-in-linear-slow h-full w-full">
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
            href: "/docs/scope/what",
          },
          {
            q: "Why",
            a: "Technology is an enabler for creativity, inspiration and thinking",
            href: "/docs/scope/why",
          },
          {
            q: "How",
            a: "Build abstractions that seamlessly connect data, logic, devices and services",
            href: "/docs/scope/how",
          },
          {
            a: (
              <NavigateButton
                destination="/welcome/pitch"
                text="Show Quick Pitch"
              />
            ),
          },
        ].map((x, xi) => (
          <div key={xi} className="m-5" style={{ textAlign: "center" }}>
            <div style={{ textAlign: "center" }} className={`fade-in-${xi}`}>
              {x.q && (
                <h2 style={{ color: "454f6d", paddingBottom: 5 }}>
                  <Link className="hover:no-underline" to={x.href}>
                    {x.q}
                  </Link>
                </h2>
              )}
              <div
                className="home-title text-lg font-serif my-4"
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
