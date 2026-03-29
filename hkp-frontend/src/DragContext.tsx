import {
  CSSProperties,
  ReactNode,
  createContext,
  useContext,
  useState,
} from "react";

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

const DragCtx = createContext<DragContextState>({});
const { Provider, Consumer: DragConsumer } = DragCtx;

type Props = {
  children: ReactNode;
  style?: CSSProperties;
};

function DragContext({ children, style }: Props) {
  const [resizeable, setResizeable] = useState<Resizable | null>(null);

  const setResizable = (res: Resizable) => setResizeable(res);
  const clearResizable = () => setResizeable(null);

  const value: DragContextState = {
    setResizable,
    clearResizable,
    resizeable,
  };

  return (
    <div
      style={s(style, t.fill)}
      onMouseMove={(ev) => resizeable && resizeable.onMove(ev)}
      onMouseUp={() => {
        if (resizeable) {
          resizeable.onEnd();
          clearResizable();
        }
      }}
    >
      <Provider value={value}>{children}</Provider>
    </div>
  );
}

export function useDragContext() {
  return useContext(DragCtx);
}

export { DragConsumer };
export default DragContext;
