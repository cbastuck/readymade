import React, { Component } from 'react';

import { Link } from 'react-router-dom';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './Welcome.css';
import { AppConsumer } from '../../AppContext';

export default class Welcome extends Component {
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
                    Build Services
                  </h1>
                  <p className="hero-claim">using other Services</p>
                  <Link to="/new">
                    <button>Start making</button>
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