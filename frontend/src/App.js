import React, { Component } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

import './App.css';
import LoginForm from './views/LoginForm';
import Board from './views/Board';

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <div
          className="App"
          style={{
            height: "100%",
            width: "100%"
          }}
        >
          <Route path="/" exact component={LoginForm} />
          <Route path="/board" component={Board} />
        </div>
      </BrowserRouter>
    );
  }
}

export default App;
