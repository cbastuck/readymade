import React, { Component } from 'react';
import joint from 'jointjs';

import { GraphConsumer } from './GraphProvider'

export default class Device extends Component {
  renderGlyph() {
    if (this.glyph) {
      return this.glyph;
    }
    this.glyph = new joint.shapes.standard.Rectangle();
    this.glyph.position(200, 60);
    this.glyph.resize(100, 40);
    this.glyph.attr({
      body: {
        fill: 'white'
      },
      label: {
        text: 'Source',
        fill: 'black'
      }
    });
    this.glyph.on('all', ev => console.log('EVENT', ev));
    return this.glyph;
  }

  render() {
    return (
      <GraphConsumer>
        {
          ({ addGlyph }) =>
            !this.glyph && addGlyph(this.renderGlyph())
        }
      </GraphConsumer>
    );
  }
}
