import React, { Component, createContext } from "react";

import { s, t } from "./styles";

const { Provider, Consumer: DragConsumer } = createContext();

class DragContext extends Component {
  state = {
    // API
    setResizable: (resizeable) => this.setState({ resizeable }),
    clearResizable: () => this.setState({ resizeable: null }),

    // Data
    resizeable: null,
  };

  render() {
    const { resizeable, clearResizable } = this.state;
    const { children, style } = this.props;
    return (
      <div
        style={s(style, t.fill)}
        onMouseMove={(ev) => resizeable && resizeable.onMove(ev)}
        onMouseUp={(ev) => {
          if (resizeable) {
            resizeable.onEnd();
            clearResizable();
          }
        }}
      >
        <Provider value={this.state}>{children}</Provider>
      </div>
    );
  }
}

export { DragConsumer };
export default DragContext;
