import { Component } from "react";
import { Location } from "react-router-dom";

import BoardContext from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";

import { withRouter } from "../../common";

import BackgroundImage from "./BackgroundImage";
import WelcomePage from "./WelcomePage";
import MissionPage from "./MissionPage";
import IntroPage from "./IntroPage";
import VisualisationPage from "./VisualisationPage";
import PageContainer, { Page } from "./PageContainer";

import "./Welcome.css";

type Props = {
  location: Location;
};

type State = {
  page: string;
  introFinished: boolean;
  visualisationFinished: boolean;
};

class Welcome extends Component<Props, State> {
  state = {
    page: "closed",
    introFinished: false,
    visualisationFinished: false,
  };

  componentDidMount() {
    this.navigateToPage();
  }

  navigateToPage = () => {
    const hash = this.props.location && this.props.location.hash;
    const page = hash ? hash.substring(1) : "welcome";
    setTimeout(() => {
      this.setState({ page });
    }, 200);
  };

  render() {
    const pages = [
      {
        p: "welcome",
        r: (
          <WelcomePage
            onNext={() =>
              this.setState({
                page: pages[1].p,
              })
            }
          />
        ),
      },
      {
        p: "mission",
        r: (
          <MissionPage
            onNext={() =>
              this.setState({
                page: pages[2].p,
              })
            }
          />
        ),
      },
      {
        p: "intro",
        r: (
          <IntroPage
            introFinished={this.state.introFinished}
            onIntroFinished={() => this.setState({ introFinished: true })}
            onNext={() =>
              this.setState({
                page: pages[3].p,
              })
            }
          />
        ),
      },
      {
        p: "visualisation",
        r: (
          <VisualisationPage
            visualisationFinished={this.state.visualisationFinished}
            onVisualisationFinished={() =>
              this.setState({ visualisationFinished: true })
            }
            onSetPage={(page) => this.setState({ page })}
          />
        ),
      },
    ];
    return (
      <BoardContext user={null}>
        <div>
          <BackgroundImage />
          <Toolbar />
          <div className={`hero-text ${this.state.page} fade-in-linear`}>
            <PageContainer
              page={this.state.page}
              pages={pages}
              onChangePage={(x: Page) =>
                this.setState({
                  page: x.p,
                  introFinished: false,
                })
              }
              visualisationFinished={this.state.visualisationFinished}
            />
          </div>
          <Footer />
        </div>
      </BoardContext>
    );
  }
}

export default withRouter(Welcome);
