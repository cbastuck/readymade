import React, { Component } from 'react'
// import { Link } from 'react-router-dom';

import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';
import './Imprint.css';

const data = '4368726973746f7068204261737475636b0a546175726f6767656e657220537472617373652033340a3130353839204265726c696e0a6d61696c40636261737475636b2e64650a3033303931393039333936';

class Separator extends Component {
  render() {
    return (
      <div 
        style={{
          width: '40%',
          borderBottom: 'solid 1px #454f6d',
          margin: '10px auto',
        }}
      >
      </div>
    )
  }
}

export default class Imprint extends Component {
  ex = data => {
    let s = '';
    for (let i = 0; i < data.length; i+=2) {
      s += String.fromCharCode(parseInt(data.substr(i, 2), 16));
    }
    return s.split('\n');
  }

  renderAddress() {
    return (
      <div>
      <canvas 
        height="90"
        ref={canvas => {
          const lines = this.ex(data); 
          const ctx = canvas && canvas.getContext('2d');
          if (ctx) {
            ctx.font = '14px Courier';
            lines.forEach((line, idx) => ctx.fillText(line, 100, idx * 20 + 10, 1000));
          }
        }} 
      />
    </div>
    );
  }

  render() {
    return (
      <div className="container">
        <Toolbar />
        <div>
          <div className="imprint-container">
            <h2 className="imprint-text">
              Information in accordance with Section 5 TMG:
            </h2>
            { this.renderAddress() }
            <Separator />
            <h2 className="imprint-text">
              Responsible for the content
              in accordance with Section 55 paragraph 2 of the German Rundfunkstaatsvertrag (RStV):
            </h2>
            { this.renderAddress() }
            <Separator />
            <h2 className="imprint-text">
              Used Images and Resources
            </h2>
            <div className="imprint-text">
              Diversity icon designed by voneff on the @NounProject. https://thenounproject.com/term/diversity/962526
            </div>
            <div className="imprint-text">
              Background Image on Startpage
              https://www.shutterstock.com/image-vector/grunge-background-abstract-geometric-pattern-squares-1196210650
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
}