import React, { Component, createContext } from'react';
import ReactDOM from 'react-dom';
import joint from 'jointjs';

import Device from './Device';

const { Provider, Consumer: GraphConsumer } = createContext();

class GraphProvider extends Component {
  constructor(props) {
		super(props);

    this.state = {
      graph: new joint.dia.Graph(),
    }

    console.log('CREATNG', this.state.graph)
  }

  componentDidMount() {
		this.paper = new joint.dia.Paper({
			el: ReactDOM.findDOMNode(this.refs.placeholder),
			width: "100%",
			height: "100%",
			model: this.state.graph,
			gridSize: 1
    });

/*
    var rect = new joint.shapes.standard.Rectangle();
    rect.position(100, 30);
    rect.resize(100, 40);
    rect.attr({
        body: {
            fill: 'blue'
        },
        label: {
            text: 'Source',
            fill: 'white'
        }
    });
    rect.addTo(this.state.graph);

    var rect2 = rect.clone();
    rect2.translate(300, 0);
    rect2.attr('label/text', 'Sink');
    rect2.addTo(this.graph);

    var link = new joint.shapes.standard.Link();
    link.source(rect);
    link.target(rect2);
    link.addTo(this.graph);
*/
  }

  render() {
    const { children } = this.props;
    return(
      <Provider
        value={{
          ...this.state
        }}
      >
        <Device /
        <div
          ref="placeholder"
          style={{
            height: "100%",
            width: "100%",
            backgroundColor: 'red'
          }}
        >
          { children }
        </div>
      </Provider>
    );
  }
}

export { GraphProvider, GraphConsumer };
