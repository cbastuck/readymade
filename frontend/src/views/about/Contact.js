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
            <div 
              style={{ 
                fontSize: 40,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontWeight: 'bold',
              }}
            >
              Email
            </div>
            <div
              style={{
                margin: '7px 0px',
                textTransform: 'lowercase',
                fontSize: 18,
              }}
            >
              <a 
                href="mailto:mail@hookup.to"
                style={{
                  
                }}
              >
                mail@hookup.to
              </a>
            </div>
          </div>
        </div>
      <Footer />
      </div>
    );
  }
}