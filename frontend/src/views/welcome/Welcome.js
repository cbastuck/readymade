import React, { Component } from 'react';

import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './Welcome.css';
import { AppConsumer } from '../../AppContext';

export default class Welcome extends Component {
  state = {
    page: 'welcome'
  };

  renderWelcome() {
    return (
      <div className="hero-text">
        <h1>Welcome.</h1>
        <p className="hero-claim">
          <span className="make">Make</span> yourself at home
        </p>
        <button
          className="button"
          onClick={() => this.setState({ page: 'intro' }) }
        >
          What's next?
        </button>
      </div>
    );
  }

  renderIntro() {
    return (
      <div className="hero-text">
        <iframe 
          title="Hookup Intro Board"
          src="/sandbox?src=/introduction.json" 
          height="100%"
          width="100%"
          frameBorder="0"
        />
        <button
          className="button back-button"
          onClick={() => this.setState({ page: 'welcome' }) }
        >
          Next
        </button>
      </div>
    );
  }

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
                  { this.state.page === 'welcome' && this.renderWelcome() } 
                  { this.state.page === 'intro' && this.renderIntro() } 
                <Footer />
              </div>
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}