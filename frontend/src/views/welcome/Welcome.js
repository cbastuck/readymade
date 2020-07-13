import React, { Component } from 'react';

import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';
import Sandbox from '../Sandbox';
import {
  redirectTo,
} from '../../core/actions';

import './Welcome.css';
import { AppConsumer } from '../../AppContext';

export default class Welcome extends Component {
  state = {
    page: 'closed'
  };

  componentDidMount() {
    setTimeout(() => {
      this.setState({ page: 'welcome' });
    }, 200);
  }

  renderWelcome = () => (
    <div className="fade-in">
      <h1>Welcome.</h1>
      <p className="hero-claim">
        <span className="make">Make yourself</span> 
        <span>at home</span>
      </p>
      <button
        className="button"
        onClick={() => this.setState({ page: 'mission' }) }
      >
        What is this?
      </button>
    </div>
  );
  
  renderIntro = () => (
    <div style={{ height: '100%' }}>
      <Sandbox
        title="Hookup Intro"
        src="/boards/introduction.json"
        frameless="true"
        frameBorder={0}
        height="84%"
        width="100%"
        onAction={({ finished }) => finished && this.setState({ introFinished: true })}
      />
      {
        this.state.introFinished && (
          <button
            style={{ fontSize: 14 }}
            className="button" 
            onClick={() => this.setState({ page: 'visualisation' })}
          >
            A thought experiment
          </button>
        )
      }
    </div>
  );


  renderVisualisation = () => {
    return (
      <div style={{ height: '100%' }}>
        <Sandbox
          title="Hookup Visualisation"
          src="/boards/visualisation.json"
          frameless="true"
          frameBorder={0}
          height="100%"
          width="100%"
          onAction={({ page, finished }) => {
            if (page) {
              this.setState({ page });
            }
            if (finished) {
              redirectTo('/ftu')
            }
          }}
        />
      </div>
    );
  }

  renderMission = () => {
    return (
      <div className="fade-in-linear-slow" style={{ width: '100%', height: '100%' }}>
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'table',
            tableLayout: 'fixed',
          }}
        >
        {
          [
            { q: 'What', a: 'An attempt to make technology more accessible and personal' },
            { q: 'Why', a: 'Because tech is an enabler for creativity, inspiration and thinking' },
            { q: 'How', a: 'Creatively connect logic, devices and services' },
            { 
              a: (
              <button
                style={{ fontSize: 14 }}
                className="button" 
                onClick={() => this.setState({ page: 'intro' })}
              >
                More details
              </button>
              ),
            }
          ].map((x, xi) => (
            <div
              key={xi}
              style={{
                textAlign: 'center', 
                display: 'table-row' 
              }}
            >
              <div
                style={{
                  display: 'table-cell',
                  verticalAlign: 'middle',
                  textAlign: 'center'
                }}
              >
                { x.q && <h1 style={{ fontSize: 27 }}> {x.q} </h1> }
                <div style={{ marginTop: 5, fontSize: 17 }}> {x.a} </div>
              </div>
            </div>
          )) 
        }
        </div>
      </div>
    );
  }

  renderConversion = () => {
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
      </div>
    );
  }

  renderNavBar = (pages) => {
    if (this.state.page === pages[0].p) {
      return false;
    }
     const renderBullet = (x, c) => (
      <span
        key={x.p}
        style={{ cursor: 'pointer', padding: 5 }}
        onClick={() => this.setState({ page: x.p })}
      >
        { c }
      </span>
    );
    return (
      <div 
        style={{ 
          fontSize: 22,
          marginTop: 20,
        }}
      > 
        { 
          pages.map(x => x.p === this.state.page ? 
            renderBullet(x, '●') : 
            renderBullet(x, '￮')) 
        }
      </div>
    );
  }

  renderContent(pages) {
    const currentPage = pages.find(x => x.p === this.state.page);
    return (
      <div 
        style={{ 
          width: '100%', 
          height: '95%',
        }}
      >
        { currentPage && currentPage.r() }
        { this.renderNavBar(pages) }
      </div>
    );
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
                  { 
                    this.renderContent(
                      [
                        { p: 'welcome', r: this.renderWelcome },
                        { p: 'mission', r: this.renderMission },
                        { p: 'intro', r: this.renderIntro },
                        { p: 'visualisation', r: this.renderVisualisation },
                      ]
                    )
                  }
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