import { CSSProperties, Component, ReactNode, createContext } from "react";

import { s, t } from "./styles";

type Resizable = {
  onMove: (ev: any) => void;
  onEnd: () => void;
};

type DragContextState = {
  setResizable?: (res: Resizable) => void;
  clearResizable?: () => void;
  resizeable?: Resizable | null;
};

const { Provider, Consumer: DragConsumer } = createContext<DragContextState>(
  {}
);

type Props = {
  children: ReactNode;
  style?: CSSProperties;
};

class DragContext extends Component<Props> {
  state: DragContextState = {
    // API
    setResizable: (resizeable: Resizable) => this.setState({ resizeable }),
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
        onMouseUp={() => {
          if (resizeable && clearResizable) {
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
