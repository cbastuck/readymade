import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import './Footer.css';

export default class Footer extends Component {
  render() {
    const fontStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 11
    };
    return (
      <div>
        <div style={{ width: '100%', height: 50 }}> </div>
        <div className="footer-container">
          <div className="footer-link" style={fontStyle}>
            <Link to="/about"> about </Link>
            {' ‧ '}
            <Link to="/imprint"> imprint </Link>
            {' ‧ '}
            <Link to="/contact"> contact </Link>
          </div>
        </div>
      </div>
    );
  }
}