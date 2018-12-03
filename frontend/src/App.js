import React, { Component } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import LoginForm from './views/LoginForm';
import BuildBoard from './views/BuildBoard';
import Board from './views/Board';

class App extends Component {
  render() {
    return (
      <Router>
        <div
          className="App"
          style={{
            height: "100%",
            width: "100%"
          }}
        >
          <Route path="/" exact component={BuildBoard} />
          <Route path="/login" component={LoginForm} />
          <Route component={Board} />
        </div>
      </Router>
    );
  }
}

export default App;
