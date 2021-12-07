import React, { Component } from "react";
import { Route, Switch } from "react-router-dom";

import AppContext from "./AppContext";

import Welcome from "./views/welcome/Welcome";
import About from "./views/about/About";
import Imprint from "./views/about/Imprint";
import Contact from "./views/about/Contact";
import Examples from "./views/examples/Examples";
import Quickstart from "./views/docs/Quickstart";
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
import Playground from "./views/playground/index";
import BoardSource from "./views/playground/BoardSource";
//import Playground from "./views/PlaygroundLegacy";
import Sandbox from "./Sandbox";
import Import from "./Import";
import Join from "./Join";
import ServiceRedirect from "./views/ServiceRedirect";
import MessageDispatcher from "./MessageDispatcher";
import Headless from "./views/headless";

import "./App.css";

class App extends Component {
  render() {
    return (
      <AppContext>
        <div
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <Switch>
            <Route path="/" exact component={Welcome} />
            <Route path="/sandbox" component={Sandbox} />
            <Route path="/import" component={Import} />
            <Route path="/about" component={About} />
            <Route path="/contact" component={Contact} />
            <Route path="/imprint" component={Imprint} />
            <Route path="/new" exact component={BuildBoard} />
            <Route path="/login" component={Login} />
            <Route path="/loginFail" component={LoginFail} />
            <Route path="/auth2app" component={AuthRedirect} />
            <Route path="/:board/app" component={AppHub} />
            <Route path="/service/:service" component={ServiceReferenceView} />
            <Route path="/datamodel/:name" component={DataModelReferenceView} />
            <Route path="/examples" component={Examples} />
            <Route path="/dashboard" component={MyBoards} />
            <Route path="/docs/service" component={ServiceDocumentation} />
            <Route path="/docs/board" component={BoardDocumentation} />
            <Route path="/docs/runtime" component={RuntimeDocumentation} />
            <Route path="/docs" component={Quickstart} />
            <Route path="/serviceRedirect" component={ServiceRedirect} />
            <Route path="/join/:share" component={Join} />
            <Route path="/playground/:board/src" component={BoardSource} />
            <Route path="/playground/:board" component={Playground} />
            <Route path="/playground" component={Playground} />
            <Route path="/headless" component={Headless} />
            <Route path="/:board" component={BoardWithContext} />
          </Switch>
        </div>

        <MessageDispatcher />
      </AppContext>
    );
  }
}

export default App;
