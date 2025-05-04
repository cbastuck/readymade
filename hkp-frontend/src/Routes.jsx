import {
  Route,
  Routes as RouterRoutes,
  Navigate,
  useLocation,
} from "react-router-dom";

import WelcomeTemplate from "./views/welcome/WelcomeTemplate";
import WelcomePage from "./views/welcome/WelcomePage";
import MissionPage from "./views/welcome/MissionPage";
import PitchPage from "./views/welcome/PitchPage";
import ExperimentPage from "./views/welcome/ExperimentPage";
import About from "./views/about/About";

import Updates from "./views/docs/Updates";

import Sandbox from "./Sandbox";
import Playground from "./views/playground/index";
import Examples from "./views/examples/Examples";
import Example from "./views/examples/Example";
import Quickstart from "./views/docs/Quickstart";
import Docs from "./views/docs";

import Home from "./views/home";
import HomeWidgetImport from "./views/home/ImportWidget.tsx";

import BuildBoard from "./views/BuildBoard";
import AuthRedirect from "./views/AuthRedirect";
import AuthRedirectAuth0 from "./views/AuthRedirectAuth0";
import Login from "./views/LoginAuth0";
import Logout from "./views/LogoutAuth0";
import Import from "./Import";
import Profile from "./views/profile";
import Remotes from "./views/remotes";

import Headless from "./views/headless";
import Join from "./Join";

import Dashboard from "./views/dashboard";
import WhatPitch from "./views/docs/scope/What";
import WhyPitch from "./views/docs/scope/Why";
import HowPitch from "./views/docs/scope/How";
import Identity from "./views/docs/scope/identity";

import BoardBlock from "./views/docs/buildingblocks/BoardBlock";
import RuntimeBlock from "./views/docs/buildingblocks/RuntimeBlock";
import ServiceBlock from "./views/docs/buildingblocks/ServiceBlock";

import Blog from "./views/docs/blog";
import Engage from "./views/engage/Engage";
import Terms from "./views/terms";
import Privacy from "./views/privacy";

import Track from "./views/docs/tracks";

import BridgeTrack from "./views/docs/tracks/bridge";
import RemoteTrack from "./views/docs/tracks/remote";

import StarterTutorial from "./views/docs/tutorials/1-Onboarding";

import ServiceRedirect from "./views/ServiceRedirect";

import Prototypes from "./views/docs/prototypes";
import Spotty from "./views/docs/prototypes/Spotty";
import Multiplication from "./views/docs/prototypes/Multiplication";

import { generateRandomName } from "./core/board";
import { replacePlaceholders } from "./core/url";

import Spreadsheet from "./views/spreadsheet";

export default function Routes() {
  return (
    <RouterRoutes>
      <Route path="/" exact element={<Navigate replace to="/welcome" />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route
        path="/welcome/mission"
        element={
          <WelcomeTemplate pageStyle={{ paddingTop: "25px", height: "450px" }}>
            <MissionPage />
          </WelcomeTemplate>
        }
      />
      <Route
        path="/welcome/pitch"
        element={
          <WelcomeTemplate pageStyle={{ paddingTop: "25px", height: "450px" }}>
            <PitchPage />
          </WelcomeTemplate>
        }
      />
      <Route
        path="/welcome/experiment"
        element={
          <WelcomeTemplate pageStyle={{ paddingTop: "25px", height: "450px" }}>
            <ExperimentPage />
          </WelcomeTemplate>
        }
      />
      <Route path="/about" element={<About />} />

      <Route path="/sandbox" element={<Sandbox />} />

      <Route path="/playground/:board" element={<Playground />} />
      <Route path="/playground" element={<PlaygroundRedirect />} />

      <Route path="/example/sandbox" element={<Example />} />
      <Route path="/examples" element={<Examples />} />

      {/*<Route path="/new" exact element={<BuildBoard />} />*/}
      <Route path="/login" element={<Login />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/auth2app" element={<AuthRedirect />} />
      <Route path="/authRedirect" element={<AuthRedirectAuth0 />} />
      <Route path="/import" element={<Import />} />

      <Route path="/profile" element={<Profile />} />
      <Route path="/home" element={<Home />} />
      <Route path="/home/import-widget" element={<HomeWidgetImport />} />

      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/updates" element={<Updates />} />
      <Route path="/docs/quickstart" element={<Quickstart />} />
      <Route path="/docs/scope/what" element={<WhatPitch />} />
      <Route path="/docs/scope/why" element={<WhyPitch />} />
      <Route path="/docs/scope/how" element={<HowPitch />} />
      <Route path="/docs/scope/identity" element={<Identity />} />

      <Route path="/docs/tracks" element={<Track />}>
        <Route path="bridge" element={<BridgeTrack />} />
        <Route path="remote" element={<RemoteTrack />} />
      </Route>
      <Route path="/docs/blog/:article" element={<Blog />} />

      <Route path="/docs/buildingblock/board" element={<BoardBlock />} />
      <Route path="/docs/buildingblock/runtime" element={<RuntimeBlock />} />
      <Route path="/docs/buildingblock/service" element={<ServiceBlock />} />

      <Route path="/docs/tutorials/starter" element={<StarterTutorial />} />

      <Route path="/docs/proto" element={<Prototypes />}>
        <Route path="spotty" element={<Spotty />} />
        <Route path="multiplication" element={<Multiplication />} />
      </Route>

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/serviceRedirect" element={<ServiceRedirect />} />

      <Route path="/engage" element={<Engage />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route path="/headless" element={<Headless />} />
      <Route path="/join/:share" element={<Join />} />
      <Route path="/remotes" element={<Remotes />} />
      <Route path="/remotes/:remote" element={<Remotes />} />

      <Route path="/spreadsheet" element={<Spreadsheet />} />
    </RouterRoutes>
  );
}

function PlaygroundRedirect() {
  const location = useLocation();
  const { search = "" } = location;
  return (
    <Navigate
      to={replacePlaceholders(`/playground/${generateRandomName()}${search}`)}
      replace={true}
    />
  );
}
