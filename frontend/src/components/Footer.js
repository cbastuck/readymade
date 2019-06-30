import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import './Footer.css';

export default class Footer extends Component {
  render() {
    return (
      <div className="footer-container">
        <div className="footer-link">
          <Link to="/about">about</Link>
        </div>
      </div>
    );
  }
}