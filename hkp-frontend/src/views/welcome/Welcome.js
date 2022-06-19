import React, { Component } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AppConsumer } from "../../AppContext";
import BoardContext from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";
import ProgressIndicator from "../../components/ProgressIndicator";
import SandboxFrame from "../../components/SandboxFrame";
import { redirectTo } from "../../core/actions";
import News from "./News";
import { withRouter } from "../../common";

import "./Welcome.css";

function NavigateButton({ destination, text }) {
  const navigate = useNavigate();
  return (
    <button
      className="button"
      onClick={() => navigate(destination)}
      style={{
        fontSize: 11,
        textTransform: "uppercase",
      }}
    >
      {text}
    </button>
  );
}

class Welcome extends Component {
  state = {
    page: "closed",
    introFinished: false,
    visualisationFinished: false,
  };

  componentDidMount() {
    this.navigateToPage();
  }

  componentDidUpdate(prevProps) {
    const currentSearch = this.props.location && this.props.location.search;
    if (currentSearch !== prevProps.location.search) {
      this.navigateToPage();
    }
  }

  navigateToPage = () => {
    const search = this.props.location && this.props.location.search;
    const params = search
      ? Object.fromEntries(new URLSearchParams(search))
      : {};
    const page = params.page || "welcome";
    setTimeout(() => {
      this.setState({ page });
    }, 200);
  };

  renderWelcome = () => (
    <div className="fade-in">
      <h1
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          marginLeft: 25,
        }}
      >
        Welcome
        <News />
      </h1>

      <p className="hero-claim">
        <span className="make">Make yourself</span>
        <span style={{ paddingLeft: 3 }}>at home</span>
      </p>
      <NavigateButton destination="/?page=mission" text="What is this?" />
    </div>
  );

  renderIntro = () => (
    <div style={{ height: "100%" }}>
      <SandboxFrame
        title="Hookup Intro"
        src="/boards/introduction.json"
        frameless={true}
        frameBorder={0}
        height="84%"
        width="100%"
        maxWidth={800}
        onAction={({ checkpoint }) => {
          if (checkpoint === "@last-slide") {
            setTimeout(() => this.setState({ introFinished: true }), 500);
          } else if (checkpoint) {
            this.progress && this.progress.triggerAnimation();
          }
        }}
      />
      <ProgressIndicator
        durationInSec={7}
        ref={(progress) => (this.progress = progress)}
        visible={!this.state.introFinished}
      />
      {this.state.introFinished && (
        <NavigateButton
          destination="/?page=visualisation"
          text="A thought experiment"
        />
      )}
    </div>
  );

  renderVisualisation = () => {
    return (
      <div style={{ height: "100%" }}>
        <SandboxFrame
          title="Hookup Visualisation"
          src="/boards/visualisation.json"
          frameless={true}
          frameBorder={0}
          height="95%"
          width="100%"
          maxWidth={800}
          onAction={({ page, finished, checkpoint }) => {
            if (page) {
              this.setState({ page });
            }
            if (finished) {
              redirectTo("/examples");
            }
            if (
              checkpoint === "@last-state" &&
              !this.state.visualisationFinished
            ) {
              this.setState({ visualisationFinished: true });
            }
          }}
        />
        {this.state.visualisationFinished && (
          <button
            style={{
              fontSize: 12,
              textTransform: "uppercase",
            }}
            className="button fade-in-linear"
            onClick={() => redirectTo("/examples")}
          >
            Examples
          </button>
        )}
      </div>
    );
  };

  renderMission = () => {
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
              a: "Explore abstractions to creatively connect data, logic, devices and services",
              href: "/docs/pitch/how",
            },
            {
              a: (
                <NavigateButton destination="/?page=intro" text="Quick Pitch" />
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
                }}
                className={`fade-in-${xi}`}
              >
                {x.q && (
                  <h1
                    style={{ fontSize: 19, color: "454f6d", paddingBottom: 5 }}
                  >
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
                        fontSize: 10,
                        textTransform: "capitalize",
                        fontFamily: "Lato",
                      }}
                    >
                      {" - show more"}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  renderConversion = () => {
    return (
      <div className="fade-in">
        <h1>You are early</h1>
        <p className="hero-claim">
          <span className="make">come back later, please</span>
        </p>
        <button
          className="button"
          onClick={() => this.setState({ page: "welcome" })}
        >
          Do it again
        </button>
      </div>
    );
  };

  renderNavBar = (pages) => {
    if (this.state.page === pages[0].p || this.state.visualisationFinished) {
      return false;
    }
    const renderBullet = (x, c) => (
      <span
        key={x.p}
        style={{ cursor: "pointer", padding: 5 }}
        onClick={() =>
          this.setState({
            page: x.p,
            introFinished: false,
          })
        }
      >
        {c}
      </span>
    );
    return (
      <div
        style={{
          fontSize: 22,
          marginTop: 20,
        }}
      >
        {pages.map((x) =>
          x.p === this.state.page ? renderBullet(x, "●") : renderBullet(x, "￮")
        )}
      </div>
    );
  };

  renderContent(pages) {
    const currentPage = pages.find((x) => x.p === this.state.page);
    return (
      <div
        style={{
          width: "100%",
          height: "95%",
          fontFamily: "Roboto",
          fontSize: 15,
        }}
      >
        {currentPage && currentPage.r()}
        {this.renderNavBar(pages)}
      </div>
    );
  }

  render() {
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardContext user={null}>
            <div className="hero-image">
              <Toolbar />
              <div className={`hero-text ${this.state.page} fade-in-linear`}>
                {this.renderContent([
                  { p: "welcome", r: this.renderWelcome },
                  { p: "mission", r: this.renderMission },
                  { p: "intro", r: this.renderIntro },
                  { p: "visualisation", r: this.renderVisualisation },
                ])}
              </div>
              <Footer />
            </div>
          </BoardContext>
        )}
      </AppConsumer>
    );
  }
}

export default withRouter(Welcome);
