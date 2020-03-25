import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch
} from 'react-router-dom';

import AppContext from './AppContext';

import Welcome from './views/welcome/Welcome';
import About from './views/about/About';
import Imprint from './views/about/Imprint';
import Board from './views/Board';
import BuildBoard from './views/BuildBoard';
import AuthRedirect from './views/AuthRedirect';
import AppHub from './views/AppHub';
import Login from './views/Login';
import LoginFail from './views/LoginFail';
import BoardProvider from './BoardContext';
import Sandbox from './Sandbox';

import { AppConsumer } from './AppContext';

import './App.css';

class BoardWithContext extends Component {
  render() {
    const { match } = this.props;
    const boardName = match.params.board;
    return (
      <AppConsumer>
        {
          appContext => 
            <BoardProvider boardName={boardName}>
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
              <Route path="/about" component={About} />
              <Route path="/imprint" component={Imprint} />
              <Route path="/new" exact component={BuildBoard} />
              <Route path="/login" component={Login} />
              <Route path="/loginFail" component={LoginFail} />
              <Route path="/auth2app" component={AuthRedirect} />
              <Route path="/:board/app" component={AppHub} />
              <Route path="/:board" component={BoardWithContext} />
            </Switch>
          </div>
        </Router>
      </AppContext>
    );
  }
}

export default App;
