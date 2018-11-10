import React, { Component } from 'react'
import ReactDOM from 'react-dom';

import joint from 'jointjs';

class Board extends Component {
  constructor(props) {
		super(props);

    this.graph = new joint.dia.Graph();
		this.cells=[];
  }

  componentDidMount() {
		new joint.dia.Paper({
			el: ReactDOM.findDOMNode(this.refs.placeholder),
			width: "100%",
			height: "100%",
			model: this.graph,
			gridSize: 1
		});

		var rect = new joint.shapes.standard.Rectangle();
    rect.position(100, 30);
    rect.resize(100, 40);
    rect.attr({
        body: {
            fill: 'blue'
        },
        label: {
            text: 'Hello',
            fill: 'white'
        }
    });
    rect.addTo(this.graph);

    var rect2 = rect.clone();
    rect2.translate(300, 0);
    rect2.attr('label/text', 'World!');
    rect2.addTo(this.graph);

    var link = new joint.shapes.standard.Link();
    link.source(rect);
    link.target(rect2);
    link.addTo(this.graph);
	}

  render() {
    return (
      <div
        ref="placeholder"
        style={{
          height: "100%",
          width: "100%"
        }}
      >

        </div>
    );
  }
}

export default Board
