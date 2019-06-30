import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch
} from 'react-router-dom';

import AppContext from './AppContext';
import LoginForm from './views/LoginForm';

import Welcome from './views/Welcome';
import Board from './views/Board';
import BuildBoard from './views/BuildBoard';
import AuthRedirect from './views/AuthRedirect';
import AppHub from './views/AppHub';
import BoardProvider from './BoardContext';

class BoardWithContext extends Component {
  render() {
    const { match } = this.props;
    const boardName = match.params.board;
    return (
      <BoardProvider boardName={boardName}>
        <Board />
      </BoardProvider>
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
              <Route path="/new" exact component={BuildBoard} />
              <Route path="/login" component={LoginForm} />
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
