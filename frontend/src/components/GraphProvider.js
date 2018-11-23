import React, { Component, createContext } from'react';
import ReactDOM from 'react-dom';
import joint from 'jointjs';

import { BoardConsumer } from '../views/Board';

const { Provider, Consumer: GraphConsumer } = createContext();

class GraphProvider extends Component {
  constructor(props) {
		super(props);

    this.graph = new joint.dia.Graph();
    this.state = {
      glyphs: [],
      addGlyph: glyph =>
        setTimeout(() =>
          this.setState({
            glyphs: this.state.glyphs.concat(glyph)
          })
        )
    };
  }

  renderPaper = (placeholder, app) => {
    if (!this.paper) {
      this.paper = new joint.dia.Paper({
        el: ReactDOM.findDOMNode(placeholder),
        width: "100%",
        height: "100%",
        model: this.graph,
        gridSize: 1
      });
      this.paper.on(
        'cell:pointerclick',
        (ev, cell, x, xx) =>
          (app.mode === 'connection') &&
            console.log('Even', ev, cell, x, xx)
      );
    }
    return this.paper;
  }

  render() {
    return(
      <Provider
        value={{
          ...this.state
        }}
      >
        <BoardConsumer>
          {
            app => (
              <div
                ref={placeholder => this.renderPaper(placeholder, app)}
                style={{
                  height: '100%',
                  width: '100%',
                  border: 'solid 1px gray',
                  borderRadius: 3
                }}
              >
                { this.props.children }
                { this.state.glyphs.forEach(glyph => glyph.addTo(this.graph)) }
              </div>
            )
          }
        </BoardConsumer>
      </Provider>
    );
  }
}

export { GraphProvider, GraphConsumer };
