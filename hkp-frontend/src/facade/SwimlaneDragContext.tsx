import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * What separate swimlane widgets know about each other.
 *
 * Cards do not live here: every lane reads the same service notification and
 * SQL remains authoritative. This context lets a drop target know which card
 * is currently crossing the facade from another widget, and lets a card name
 * the lanes it could be sent to without being dragged there. `group` keeps two
 * unrelated sets of lanes on one facade from accepting each other's cards.
 */
export type DraggedSwimlaneCard = {
  group: string;
  cardId: string | number;
  fromLaneId: string | number;
  fromPosition: number;
  item: Record<string, unknown>;
};

/** A lane that takes cards, as the other lanes of its group see it. */
export type SwimlaneDropTarget = {
  group: string;
  laneId: string | number;
  title: string;
  /** Takes the card below the lane's last one, as a drop onto the lane does. */
  receive: (card: DraggedSwimlaneCard) => void;
};

type SwimlaneDragStore = {
  dragged: DraggedSwimlaneCard | null;
  setDragged: (card: DraggedSwimlaneCard | null) => void;
  targets: SwimlaneDropTarget[];
  /** Lists a lane among the targets until the function it returns is called. */
  addTarget: (target: SwimlaneDropTarget) => () => void;
};

const EMPTY_STORE: SwimlaneDragStore = {
  dragged: null,
  setDragged: () => {},
  targets: [],
  addTarget: () => () => {},
};

export const SwimlaneDragContext = createContext<SwimlaneDragStore>(EMPTY_STORE);

export function SwimlaneDragProvider({ children }: { children: ReactNode }) {
  const [dragged, setDragged] = useState<DraggedSwimlaneCard | null>(null);
  const [targets, setTargets] = useState<SwimlaneDropTarget[]>([]);
  const addTarget = useCallback((target: SwimlaneDropTarget) => {
    setTargets((prev) => [...prev, target]);
    return () => setTargets((prev) => prev.filter((other) => other !== target));
  }, []);
  const store = useMemo(
    () => ({ dragged, setDragged, targets, addTarget }),
    [dragged, targets, addTarget],
  );

  return (
    <SwimlaneDragContext.Provider value={store}>
      {children}
    </SwimlaneDragContext.Provider>
  );
}

export const useSwimlaneDrag = () => useContext(SwimlaneDragContext);
