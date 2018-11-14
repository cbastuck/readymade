import React, { Component, createContext } from'react';
import ReactDOM from 'react-dom';
import joint from 'jointjs';

const { Provider, Consumer: GraphConsumer } = createContext();

class GraphProvider extends Component {
  constructor(props) {
		super(props);

    const { onAddDevice } = props;
    this.graph = new joint.dia.Graph();
    this.state = {
      addElement: onAddDevice
    };
  }

  componentDidMount() {
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

/*
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

  renderPaper = placeholder =>
    new joint.dia.Paper({
			el: ReactDOM.findDOMNode(placeholder),
			width: "100%",
			height: "100%",
			model: this.graph,
			gridSize: 1
    });

  renderDevice = device => {
    device.addTo(this.graph);
    return undefined;
  }

  render() {
    const { devices } = this.props;
    return(
      <Provider
        value={{
          ...this.state
        }}
      >
       { this.state.counter }
        <div
          ref={this.renderPaper}
          style={{
            height: '100%',
            width: '100%',
            border: 'solid 1px gray',
            borderRadius: 10
          }}
        >
          { this.props.children }
          { devices.map(this.renderDevice) }
        </div>
      </Provider>
    );
  }
}

export { GraphProvider, GraphConsumer };
