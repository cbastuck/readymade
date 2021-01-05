import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';

export default class LoginFail extends Component {
  render() {
    const errorMessage = this.props.location &&
      this.props.location.state && 
      this.props.location.state.errorMessage;
    
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext>
              <div className="hero-image">
                <BoardConsumer>
                  {
                    boardContext => 
                      <Toolbar 
                        onAction={boardContext.onAction}
                      />
                  }
                </BoardConsumer>
                <div className="hero-text">
                  <h1>
                    Login failed
                  </h1>
                  {
                    errorMessage && (
                      <div> { /*errorMessage*/ } </div>
                    )
                  }
                  <div style={{ marginTop: 15 }}>
                    <Link to="/new"> 
                      <button className="button">
                        Try again
                      </button>
                    </Link>
                  </div>
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