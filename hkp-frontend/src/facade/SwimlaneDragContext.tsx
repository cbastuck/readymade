import {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * The one piece of transient state shared by separate swimlane widgets.
 *
 * Cards do not live here: every lane reads the same service notification and
 * SQL remains authoritative. This context only lets a drop target know which
 * card is currently crossing the facade from another widget. `group` keeps two
 * unrelated sets of lanes on one facade from accepting each other's cards.
 */
export type DraggedSwimlaneCard = {
  group: string;
  cardId: string | number;
  fromLaneId: string | number;
  fromPosition: number;
  item: Record<string, unknown>;
};

type SwimlaneDragStore = {
  dragged: DraggedSwimlaneCard | null;
  setDragged: (card: DraggedSwimlaneCard | null) => void;
};

const EMPTY_STORE: SwimlaneDragStore = {
  dragged: null,
  setDragged: () => {},
};

export const SwimlaneDragContext = createContext<SwimlaneDragStore>(EMPTY_STORE);

export function SwimlaneDragProvider({ children }: { children: ReactNode }) {
  const [dragged, setDragged] = useState<DraggedSwimlaneCard | null>(null);
  const store = useMemo(() => ({ dragged, setDragged }), [dragged]);

  return (
    <SwimlaneDragContext.Provider value={store}>
      {children}
    </SwimlaneDragContext.Provider>
  );
}

export const useSwimlaneDrag = () => useContext(SwimlaneDragContext);
