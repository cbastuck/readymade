import React, { Component } from 'react';

import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

export default class Contact extends Component {
  render() {
    return (
       <div>
        <Toolbar />
        <div className="about-image container">
          <div className="about-text">
            <h1>Email</h1>
            <p>
              to <a href="mailto:mail@hookup.to">mail@hookup.to</a>
            </p>
          </div>
        </div>
      <Footer />
      </div>
    );
  }
}