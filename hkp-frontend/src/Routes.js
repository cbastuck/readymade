import { Route, Routes, Navigate, useLocation } from "react-router-dom";

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
import BoardSource from "./views/playground/BoardSource";
import BuildBoard from "./views/BuildBoard";
import AuthRedirect from "./views/AuthRedirect";
import AuthRedirectAuth0 from "./views/AuthRedirectAuth0";
import Import from "./Import";
import Login from "./views/Login";
import Profile from "./views/profile";

import LoginFail from "./views/LoginFail";
//import BoardWithContext from "./views/BoardWithContext";
import Headless from "./views/headless";
import Join from "./Join";
import ServiceReferenceView from "./views/ServiceReferenceView";
import DataModelReferenceView from "./views/DataModelReferenceView";

import Dashboard from "./views/dashboard";
import WhatPitch from "./views/docs/pitch/What";
import WhyPitch from "./views/docs/pitch/Why";
import HowPitch from "./views/docs/pitch/How";

import BoardBlock from "./views/docs/buildingblocks/BoardBlock";
import RuntimeBlock from "./views/docs/buildingblocks/RuntimeBlock";
import ServiceBlock from "./views/docs/buildingblocks/ServiceBlock";

import Blog from "./views/docs/blog";
import Engage from "./views/engage/Engage";
import Terms from "./views/terms";
import Privacy from "./views/privacy";

import ServiceRedirect from "./views/ServiceRedirect";

import Track from "./views/docs/tracks";
import Prototypes from "./views/docs/prototypes";
import { generateRandomName } from "./core/board";
import { replacePlaceholders } from "./core/url";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" exact element={<Navigate replace to="/welcome" />} />
      <Route
        path="/welcome"
        element={
          <WelcomeTemplate>
            <WelcomePage />
          </WelcomeTemplate>
        }
      />
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
      <Route path="/playground/:board/src" element={<BoardSource />} />
      <Route path="/playground/:board" element={<Playground />} />
      <Route path="/playground" element={<PlaygroundRedirect />} />

      <Route path="/example/sandbox" element={<Example />} />
      <Route path="/examples" element={<Examples />} />

      <Route path="/docs/updates" element={<Updates />} />
      <Route path="/docs/quickstart" element={<Quickstart />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/new" exact element={<BuildBoard />} />
      <Route path="/auth2app" element={<AuthRedirect />} />
      <Route path="/authRedirect" element={<AuthRedirectAuth0 />} />
      <Route path="/import" element={<Import />} />
      {/* old login route */}
      <Route path="/login" element={<Login />} />
      <Route path="/loginFail" element={<LoginFail />} />
      <Route path="/profile" element={<Profile />} />

      <Route path="/service/:service" element={<ServiceReferenceView />} />
      <Route path="/datamodel/:name" element={<DataModelReferenceView />} />

      <Route path="/docs/pitch/what" element={<WhatPitch />} />
      <Route path="/docs/pitch/why" element={<WhyPitch />} />
      <Route path="/docs/pitch/how" element={<HowPitch />} />
      <Route path="/docs/tracks/:track" element={<Track />} />
      <Route path="/docs/blog/:article" element={<Blog />} />

      <Route path="/docs/buildingblock/board" element={<BoardBlock />} />
      <Route path="/docs/buildingblock/runtime" element={<RuntimeBlock />} />
      <Route path="/docs/buildingblock/service" element={<ServiceBlock />} />

      <Route path="/docs/proto/:name" element={<Prototypes />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/serviceRedirect" element={<ServiceRedirect />} />

      <Route path="/engage" element={<Engage />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route path="/headless" element={<Headless />} />
      <Route path="/join/:share" element={<Join />} />
      {/* <Route path="/:board/app" element={<AppHub />} /> */}
      {/* <Route path="/:board" element={<BoardWithContext />} /> */}
    </Routes>
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
