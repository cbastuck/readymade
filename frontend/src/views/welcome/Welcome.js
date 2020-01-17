import React, { Component } from 'react';
import { Input, Button } from 'semantic-ui-react';

import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './Welcome.css';
import { AppConsumer } from '../../AppContext';

export default class Welcome extends Component {
  state = {
    page: 'welcome',
    email: ''
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
          ref={frame => {
            if (frame) {
              frame.onAction = action => 
                this.setState({ page: action.page })
            }
          }}
        />
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
          ref={frame => {
            if (frame) {
              frame.onAction = action => 
                this.setState({ page: action.page })
            }
          }}
        />
      </div>
    );
  }

  renderMission() {
    return (
      <div>
        <h1>You are early</h1>
        <p className="hero-claim">
          <span className="make">.. but still in?</span> 
        </p>
        <Input 
          placeholder="Email" 
          onChange={ev => this.setState({ email: ev.target.value })}
          value={this.state.email}
          /> 
        <div style={{ marginTop: 3 }}>
          <Button onClick={() => this.onRegisterEmail(this.state.email) }>
            Give me more
          </Button>
        </div>
      </div>
    );
  }

  onRegisterEmail(address) {
    console.log('Registering email address', address);
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
                    { this.state.page === 'mission' && this.renderMission() } 
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