import React, { Component } from 'react';

import { Link } from 'react-router-dom';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './Welcome.css';

export default class Welcome extends Component {
  render() {
    return (
      <div className="hero-image">
        <Toolbar />
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
    );
  }
}