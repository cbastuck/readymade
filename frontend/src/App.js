import React, { Component } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import AppContext from './AppContext';
import LoginForm from './views/LoginForm';
import BuildBoard from './views/BuildBoard';

import Board from './views/Board';
import AuthRedirect from './views/AuthRedirect';

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
            <Route path="/" exact component={BuildBoard} />
            <Route path="/login" component={LoginForm} />
            <Route path="/auth2app" component={AuthRedirect} />
            <Route component={Board} />
          </div>
        </Router>
      </AppContext>
    );
  }
}

export default App;
