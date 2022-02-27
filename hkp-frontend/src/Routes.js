import React from "react";
import { Route, Routes } from "react-router-dom";

import Welcome from "./views/welcome/Welcome";
import About from "./views/about/About";
import Imprint from "./views/about/Imprint";
import News from "./views/docs/News";
import Contact from "./views/about/Contact";
import Sandbox from "./Sandbox";
import Playground from "./views/playground/index";
import Examples from "./views/examples/Examples";
import Quickstart from "./views/docs/Quickstart";
import BoardSource from "./views/playground/BoardSource";

/*
import ServiceDocumentation from "./views/docs/Service";
import BoardDocumentation from "./views/docs/Board";
import RuntimeDocumentation from "./views/docs/Runtime";
import MyBoards from "./views/dashboard/MyBoards";
import BoardWithContext from "./views/BoardWithContext";
import BuildBoard from "./views/BuildBoard";
import AuthRedirect from "./views/AuthRedirect";
import AppHub from "./views/AppHub";
import Login from "./views/Login";
import LoginFail from "./views/LoginFail";
import ServiceReferenceView from "./views/ServiceReferenceView";
import DataModelReferenceView from "./views/DataModelReferenceView";


import Import from "./Import";
import Join from "./Join";
import ServiceRedirect from "./views/ServiceRedirect";
import Headless from "./views/headless";
import WhatPitch from "./views/docs/pitch/What";
import WhyPitch from "./views/docs/pitch/Why";
import HowPitch from "./views/docs/pitch/How";
*/

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" exact element={<Welcome />} />
      <Route path="/news" exact element={<News />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/imprint" element={<Imprint />} />
      <Route path="/sandbox" element={<Sandbox />} />
      <Route path="/playground/:board/src" element={<BoardSource />} />
      <Route path="/playground/:board" element={<Playground />} />
      <Route path="/playground/" element={<Playground />} />
      <Route path="/examples" element={<Examples />} />
      <Route path="/docs" element={<Quickstart />} />
      {/* 
      <Route path="/import" element={<Import />} />
      <Route path="/new" exact element={<BuildBoard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/loginFail" element={<LoginFail />} />
      <Route path="/auth2app" element={<AuthRedirect />} />
      <Route path="/:board/app" element={<AppHub />} />
      <Route path="/service/:service" element={<ServiceReferenceView />} />
      <Route path="/datamodel/:name" element={<DataModelReferenceView />} />
      
      <Route path="/dashboard" element={<MyBoards />} />
      <Route path="/docs/pitch/what" element={<WhatPitch />} />
      <Route path="/docs/pitch/why" element={<WhyPitch />} />
      <Route path="/docs/pitch/how" element={<HowPitch />} />
      <Route path="/docs/service" element={<ServiceDocumentation />} />
      <Route path="/docs/board" element={<BoardDocumentation />} />
      <Route path="/docs/runtime" element={<RuntimeDocumentation />} />
      
      <Route path="/serviceRedirect" element={<ServiceRedirect />} />
      <Route path="/join/:share" element={<Join />} />
      
      
      <Route path="/headless" element={<Headless />} />
      <Route path="/:board" element={<BoardWithContext />} /> */}
    </Routes>
  );
}
