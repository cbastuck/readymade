import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';

export default class LoginFail extends Component {
  render() {
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext
              fetchData={!!appContext.username}
            >
              <div className="hero-image">
                <BoardConsumer>
                  {
                    boardContext => 
                      <Toolbar 
                        savedBoards={boardContext.savedBoards}
                        onAction={boardContext.onAction}
                      />
                  }
                </BoardConsumer>
                <div className="hero-text">
                  <h1>
                    Login Failed
                  </h1>
                  <Link to="/new">
                    <button>Try again</button>
                  </Link>
                </div>
                <Footer />
              </div>
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}