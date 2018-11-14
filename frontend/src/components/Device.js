import React, { Component } from 'react';
import joint from 'jointjs';

import { GraphConsumer } from './GraphProvider'

export default class Device extends Component {
  renderGlyph() {
    this.glyph = new joint.shapes.standard.Rectangle();
    this.glyph.position(200, 60);
    this.glyph.resize(100, 40);
    this.glyph.attr({
      body: {
        fill: 'blue'
      },
      label: {
        text: 'Source',
        fill: 'white'
      }
    });
    return this.glyph;
  }

  render() {
    return (
      <GraphConsumer>
        {
          ({ addElement }) =>
            !this.glyph && addElement(this.renderGlyph())
        }
      </GraphConsumer>
    );
  }
}
