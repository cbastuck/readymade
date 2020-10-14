import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import './Footer.css';

export default class Footer extends Component {
  render() {
    const { flex } = this.props;
    const fontStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 11
    };
    return (
      <div 
        style={{
          position: !flex && 'fixed',
          marginTop: flex && 'auto',
          width: '100%',
          height: flex ? 45 : 30,
          bottom: !flex && 0,
          left: !flex && 0,
        }}
      >
        <div style={{
          ...fontStyle,
          marginTop: flex && 10,
          marginBottom: flex && 0,
          paddingBottom: flex && 0,
          borderTop: '1px solid rgba(34,36,38,.15)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
        }}
        >
          <div style={{ 
            marginTop: 10, 
            marginLeft: 10,
            marginBottom: 5,
          }}>
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