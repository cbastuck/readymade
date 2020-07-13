import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch
} from 'react-router-dom';

import AppContext, { AppConsumer } from './AppContext';

import Welcome from './views/welcome/Welcome';
import About from './views/about/About';
import Imprint from './views/about/Imprint';
import Contact from './views/about/Contact';
import FirstTimeExperience from './views/FirstTimeExperience';
import Board from './views/Board';
import BuildBoard from './views/BuildBoard';
import AuthRedirect from './views/AuthRedirect';
import AppHub from './views/AppHub';
import Login from './views/Login';
import LoginFail from './views/LoginFail';
import ServiceReference from './views/ServiceReference';
import BoardProvider from './BoardContext';
import Sandbox from './Sandbox';
import Import from './Import';

import './App.css';

class BoardWithContext extends Component {
  render() {
    const { match } = this.props;
    const boardName = match.params.board;
    return (
      <AppConsumer>
        {
          appContext => 
            <BoardProvider
              user={appContext.user}
              boardName={boardName}
            >
              <Board
                appContext={appContext}
              />
            </BoardProvider>
        }
      </AppConsumer>
    );
  }
}

class App extends Component {
  render() {
    return (
      <AppContext>
        <Router>
          <div
            style={{
              height: "100%",
              width: "100%"
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
              <Route path="/service/:service" component={ServiceReference} />
              <Route path="/ftu" component={FirstTimeExperience} />
              <Route path="/:board" component={BoardWithContext} />
            </Switch>
          </div>
        </Router>
      </AppContext>
    );
  }
}

export default App;
