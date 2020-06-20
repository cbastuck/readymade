import React, { Component } from 'react';
// import { Icon } from 'semantic-ui-react';

import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';
import Sandbox from '../Sandbox';

import './Welcome.css';
import { AppConsumer } from '../../AppContext';

export default class Welcome extends Component {
  state = {
    page: 'closed',
    email: ''
  };

  componentDidMount() {
    setTimeout(() => {
      this.setState({ page: 'welcome' });
    }, 200);
  }

  renderWelcome() {
    return (
      <div className="fade-in">
        <h1>Welcome.</h1>
        <p className="hero-claim">
          <span className="make">Make yourself </span> 
          <span className="at-home">at home</span>
        </p>
        <button
          className="button"
          onClick={() => this.setState({ page: 'visualisation' }) }
        >
          What next?
        </button>
      </div>
    );
  }

  renderIntro() {
    return (
      <div style={{ height: '100%' }}>
        <Sandbox
          title="Hookup Intro"
          src="/boards/introduction.json"
          frameless="true"
          frameBorder={0}
          height="100%"
          width="100%"
          onAction={action => this.setState({ page: action.page })} 
        />
      </div>
    );
  }

  renderVisualisation() {
    return (
      <div style={{ height: '100%' }} className="fade-in">
        <Sandbox
          title="Hookup Visualisation"
          src="/boards/visualisation.json"
          frameless="true"
          frameBorder={0}
          height="100%"
          width="100%"
          onAction={action => this.setState({ page: action.page })}
        />
        <div 
          style={{ 
            cursor: 'pointer', 
            color: '#427DAB',
          }} 
          onClick={() => this.setState({ page: 'mission' }) }
        >
          Skip
        </div>
      </div>
    );
  }

  renderMission() {
    return (
      <div className="fade-in">
        <h1>You are early</h1>
        <p className="hero-claim">
          <span className="make">come back later, please</span> 
        </p>
         <button
          className="button"
          onClick={() => this.setState({ page: 'welcome' }) }
        >
          Do it again
        </button>
        {
          /*
            <Input 
              placeholder="Email" 
              onChange={ev => this.setState({ email: ev.target.value })}
              value={this.state.email}
            /> 
            <div style={{ marginTop: 3 }}>
              <button
                onClick={() => this.onRegisterEmail(this.state.email) }
                className="button"
              >
                Give me more
              </button>
            </div>
        */
        }
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
              fetchData={!!appContext.user && !!appContext.user.username}
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
                <div className={`hero-text ${this.state.page} fade-in-linear`}>
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