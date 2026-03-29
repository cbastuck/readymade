import { useEffect, useRef, useState } from "react";

import { useBoardContext } from "../../BoardContext";
import Resizable from "../../components/Resizable";

type Segment = {
  name: string;
  disabled?: boolean;
  render?: (service: any) => React.ReactNode;
  component?: (props: { service: any }) => React.ReactNode;
  element?: React.ReactNode;
};

type ServiceUIProps = {
  service?: any;
  initialSegment?: (service: any) => string;
  segments?: Segment[];
  children?: (ctx: { boardContext: any; service: any }) => React.ReactNode;
  setup?: (boardContext: any, props: ServiceUIProps) => any;
  resizable?: boolean;
  onResize?: (service: any, size: any) => void;
  onInit?: (service: any) => void;
  onTimer?: (service: any) => void;
  onNotification?: (notification: any) => void;
  style?: React.CSSProperties;
  runtimeId?: string;
  [key: string]: any;
};

/*
 * THIS IS DEPRECATED
 */
export default function ServiceUI(props: ServiceUIProps) {
  const boardContext = useBoardContext();
  const {
    service: serviceProp,
    initialSegment,
    segments,
    children,
    setup: setupProp,
    resizable = true,
    onResize = () => {},
    style = {},
  } = props;

  const [currentSegmentName, setCurrentSegmentName] = useState<
    string | undefined
  >(() => (initialSegment ? initialSegment(serviceProp) : undefined));

  const serviceRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  );
  const onNotificationRef = useRef<((notification: any) => void) | null>(null);

  // componentWillUnmount equivalent
  useEffect(() => {
    return () => {
      // cleanup notification target
      if (serviceRef.current && serviceRef.current.app && onNotificationRef.current) {
        serviceRef.current.app.unregisterNotificationTarget?.(
          serviceRef.current,
          onNotificationRef.current,
        );
        onNotificationRef.current = null;
      }
      // cleanup timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, []);

  const cleanupNotificationTarget = () => {
    if (serviceRef.current && serviceRef.current.app && onNotificationRef.current) {
      serviceRef.current.app.unregisterNotificationTarget?.(
        serviceRef.current,
        onNotificationRef.current,
      );
      onNotificationRef.current = null;
    }
  };

  const cleanupTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  };

  const setup = (
    _boardContext: any,
    {
      runtimeId: _runtimeId,
      service: _backendService,
      onTimer,
      onInit,
      onNotification,
    }: ServiceUIProps,
  ): any => {
    const { service } = props;
    const hasServiceChanged = !!service && serviceRef.current !== service;

    if (hasServiceChanged) {
      cleanupNotificationTarget();
      cleanupTimer();
      serviceRef.current = service;
      if (onInit) {
        setTimeout(() => onInit(service), 0);
      }
      if (onTimer) {
        timerRef.current = setInterval(() => onTimer(service), 1000);
      }
    }

    if (
      serviceRef.current &&
      onNotification &&
      onNotificationRef.current !== onNotification
    ) {
      cleanupNotificationTarget();
      serviceRef.current.app?.registerNotificationTarget?.(
        serviceRef.current,
        onNotification,
      );
      onNotificationRef.current = onNotification;
    }

    if (!onNotification) {
      cleanupNotificationTarget();
    }

    return serviceRef.current;
  };

  const getCurrentSegmentName = (): string | undefined => {
    if (currentSegmentName) {
      return currentSegmentName;
    }

    if (!segments) return undefined;

    for (const segment of segments) {
      if (segment && !segment.disabled) {
        return segment.name;
      }
    }
  };

  const renderSegmentsHeader = (
    segs: Segment[],
    curSegName: string | undefined,
  ): React.ReactNode => {
    if (segs.length < 2) {
      return null;
    }
    return (
      <div
        style={{
          width: "60%",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <div
          style={{
            margin: "5px 0px",
            display: "flex",
            flexDirection: "row",
          }}
        >
          {segs.map((segment, idx) => (
            <div
              key={`${segment.name}-${idx}`}
              onClick={() => setCurrentSegmentName(segment.name)}
              style={{
                borderBottom: `solid 1px ${
                  curSegName === segment.name ? "lightgray" : "white"
                }`,
                borderRadius: "2px",
                width: "100%",
                padding: "5px",
              }}
            >
              <span
                style={{
                  textTransform: "capitalize",
                  fontSize: 12,
                  letterSpacing: 1,
                  color:
                    curSegName === segment.name ? "black" : "darkgray",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {segment.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSegments = (
    { service }: { service: any },
    segs: Segment[],
    isResizable: boolean,
    onResizeFn: ((service: any, size: any) => void) | undefined,
    _styleProp: React.CSSProperties,
  ): React.ReactNode => {
    if (!service) {
      return false;
    }
    const curSegName = getCurrentSegmentName();
    const segment = segs.find((seg) => seg.name === curSegName);
    return (
      <Resizable
        hideHandle={!isResizable}
        onResize={
          onResizeFn
            ? (size: any) => onResizeFn(serviceRef.current, size)
            : undefined
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%",
          }}
        >
          <div>{renderSegmentsHeader(segs, curSegName)}</div>
          <div
            style={{
              margin: "15px 20px",
              height: "100%",
            }}
          >
            {segment && segment.render && segment.render(service)}
            {segment && segment.component && segment.component({ service })}
            {segment && segment.element ? segment.element : null}
          </div>
        </div>
      </Resizable>
    );
  };

  const renderSingleSegment = (
    boardContext: any,
    childrenFn: (ctx: { boardContext: any; service: any }) => React.ReactNode,
    isResizable: boolean,
    onResizeFn: ((service: any, size: any) => void) | undefined,
    _styleProp: React.CSSProperties,
  ): React.ReactNode => {
    const c = childrenFn({
      boardContext,
      service: setupProp
        ? setupProp(boardContext, props)
        : setup(boardContext, props),
    });
    return isResizable ? (
      <Resizable
        onResize={
          onResizeFn
            ? (size: any) => onResizeFn(serviceRef.current, size)
            : undefined
        }
      >
        {c as React.ReactElement}
      </Resizable>
    ) : (
      c
    );
  };

  return (
    <>
      {segments
        ? renderSegments(
            {
              service: setupProp
                ? setupProp(boardContext, props)
                : setup(boardContext, props),
            },
            segments,
            resizable,
            onResize,
            style,
          )
        : renderSingleSegment(
            boardContext,
            children!,
            resizable,
            onResize,
            style,
          )}
    </>
  );
}
