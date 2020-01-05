import React, { Component } from 'react';

import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './Welcome.css';
import { AppConsumer } from '../../AppContext';

export default class Welcome extends Component {
  state = {
    page: 'visualisation'
  };

  renderWelcome() {
    return (
      <div>
        <h1>Welcome.</h1>
        <p className="hero-claim">
          <span className="make">Make yourself </span> 
          <span className="at-home">at home</span>
        </p>
        <button
          className="button"
          onClick={() => this.setState({ page: 'intro' }) }
        >
          What next?
        </button>
      </div>
    );
  }

  renderIntro() {
    return (
      <div style={{ height: '100%' }}>
        <iframe 
          title="Hookup Intro Board"
          src="/sandbox?src=/introduction.json&frameless=true" 
          frameBorder="0"
          style={{
            height: '100%',
            width: '100%'
          }}
        />
        <div 
          style={{ 
            textAlign: 'right',
            marginRight: 10,
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
          onClick={() => this.setState({ page: 'visualisation' })}
        >
          Why? 
        </div>
      </div>
    );
  }

  renderVisualisation() {
    return (
      <div style={{ height: '100%' }}>
        <iframe 
          title="Hookup Intro Board"
          src="/sandbox?src=/visualisation.json&frameless=true" 
          frameBorder="0"
          style={{
            height: '100%',
            width: '100%'
          }}
        />
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
                  <div className={`hero-text ${this.state.page}`}>
                    { this.state.page === 'welcome' && this.renderWelcome() } 
                    { this.state.page === 'intro' && this.renderIntro() } 
                    { this.state.page === 'visualisation' && this.renderVisualisation() } 
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