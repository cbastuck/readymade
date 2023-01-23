import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";

import Welcome from "./views/welcome/Welcome";
import About from "./views/about/About";
import Imprint from "./views/about/Imprint";
import Updates from "./views/docs/Updates";
import Contact from "./views/about/Contact";
import Sandbox from "./Sandbox";
import Playground from "./views/playground/index";
import Examples from "./views/examples/Examples";
import Quickstart from "./views/docs/Quickstart";
import Docs from "./views/docs";
import BoardSource from "./views/playground/BoardSource";
import BuildBoard from "./views/BuildBoard";
import AuthRedirect from "./views/AuthRedirect";
import Import from "./Import";
import Login from "./views/Login";
import LoginFail from "./views/LoginFail";
import BoardWithContext from "./views/BoardWithContext";
import Headless from "./views/headless";
import Join from "./Join";
import ServiceReferenceView from "./views/ServiceReferenceView";
import DataModelReferenceView from "./views/DataModelReferenceView";
import ServiceDocumentation from "./views/docs/Service";
import MyBoards from "./views/dashboard/MyBoards";
import WhatPitch from "./views/docs/pitch/What";
import WhyPitch from "./views/docs/pitch/Why";
import HowPitch from "./views/docs/pitch/How";
import BoardDocumentation from "./views/docs/Board";
import RuntimeDocumentation from "./views/docs/Runtime";
import ServiceRedirect from "./views/ServiceRedirect";
import Track from "./views/docs/tracks";
import Prototypes from "./views/docs/prototypes";
import { generateRandomName } from "./core/board";
/*
import AppHub from "./views/AppHub";
*/

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" exact element={<Welcome />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/imprint" element={<Imprint />} />
      <Route path="/sandbox" element={<Sandbox />} />
      <Route path="/playground/:board/src" element={<BoardSource />} />
      <Route path="/playground/:board" element={<Playground />} />
      <Route
        path="/playground"
        element={
          <Navigate to={`/playground/${generateRandomName()}`} replace={true} />
        }
      />
      <Route path="/examples" element={<Examples />} />
      <Route path="/docs/updates" element={<Updates />} />
      <Route path="/docs/quickstart" element={<Quickstart />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/new" exact element={<BuildBoard />} />
      <Route path="/auth2app" element={<AuthRedirect />} />
      <Route path="/import" element={<Import />} />
      <Route path="/login" element={<Login />} />
      <Route path="/loginFail" element={<LoginFail />} />

      <Route path="/service/:service" element={<ServiceReferenceView />} />
      <Route path="/datamodel/:name" element={<DataModelReferenceView />} />
      <Route path="/docs/service" element={<ServiceDocumentation />} />
      <Route path="/docs/pitch/what" element={<WhatPitch />} />
      <Route path="/docs/pitch/why" element={<WhyPitch />} />
      <Route path="/docs/pitch/how" element={<HowPitch />} />
      <Route path="/docs/tracks/:track" element={<Track />} />
      <Route path="/docs/board" element={<BoardDocumentation />} />
      <Route path="/docs/runtime" element={<RuntimeDocumentation />} />

      <Route path="/docs/proto/:name" element={<Prototypes />} />

      <Route path="/dashboard" element={<MyBoards />} />
      <Route path="/serviceRedirect" element={<ServiceRedirect />} />

      <Route path="/headless" element={<Headless />} />
      <Route path="/join/:share" element={<Join />} />
      {/* <Route path="/:board/app" element={<AppHub />} /> */}
      <Route path="/:board" element={<BoardWithContext />} />
    </Routes>
  );
}
