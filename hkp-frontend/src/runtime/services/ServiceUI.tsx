import { Component } from "react";

import { BoardConsumer } from "../../BoardContext";
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

type ServiceUIState = {
  currentSegmentName: string | undefined;
};

/*
 * THIS IS DEPRECATED
 */
export default class ServiceUI extends Component<
  ServiceUIProps,
  ServiceUIState
> {
  state: ServiceUIState = {
    currentSegmentName: undefined,
  };

  service: any;
  timer: ReturnType<typeof setInterval> | undefined;
  onNotification: ((notification: any) => void) | null = null;

  constructor(props: ServiceUIProps) {
    super(props);
    const { service, initialSegment } = props;
    if (initialSegment) {
      this.state.currentSegmentName = initialSegment(service);
    }
  }

  componentWillUnmount(): void {
    this.cleanupNotificationTarget();
    this.cleanupTimer();
  }

  cleanupNotificationTarget = (): void => {
    if (this.service && this.service.app && this.onNotification) {
      this.service.app.unregisterNotificationTarget?.(
        this.service,
        this.onNotification,
      );
      this.onNotification = null;
    }
  };

  cleanupTimer = (): void => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  };

  setup = (
    _boardContext: any,
    {
      runtimeId: _runtimeId,
      service: _backendService,
      onTimer,
      onInit,
      onNotification,
    }: ServiceUIProps,
  ): any => {
    const { service } = this.props;
    const hasServiceChanged = !!service && this.service !== service;

    if (hasServiceChanged) {
      this.cleanupNotificationTarget();
      this.cleanupTimer();
      this.service = service;
      if (onInit) {
        setTimeout(() => onInit(service), 0);
      }
      if (onTimer) {
        this.timer = setInterval(() => onTimer(service), 1000);
      }
    }

    if (
      this.service &&
      onNotification &&
      this.onNotification !== onNotification
    ) {
      this.cleanupNotificationTarget();
      this.service.app?.registerNotificationTarget?.(
        this.service,
        onNotification,
      );
      this.onNotification = onNotification;
    }

    if (!onNotification) {
      this.cleanupNotificationTarget();
    }

    return this.service;
  };

  getCurrentSegmentName = (): string | undefined => {
    const { segments } = this.props;
    const { currentSegmentName } = this.state;
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

  renderSegments = (
    { service }: { service: any },
    segments: Segment[],
    resizable: boolean,
    onResize: ((service: any, size: any) => void) | undefined,
    _style: React.CSSProperties,
  ): React.ReactNode => {
    if (!service) {
      return false;
    }
    const currentSegmentName = this.getCurrentSegmentName();
    const segment = segments.find(
      (segment) => segment.name === currentSegmentName,
    );
    return (
      <Resizable
        hideHandle={!resizable}
        onResize={
          onResize ? (size: any) => onResize(this.service, size) : undefined
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
          <div>{this.renderSegmentsHeader(segments, currentSegmentName)}</div>
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

  renderSegmentsHeader = (
    segments: Segment[],
    currentSegmentName: string | undefined,
  ): React.ReactNode => {
    if (segments.length < 2) {
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
          {segments.map((segment, idx) => (
            <div
              key={`${segment.name}-${idx}`}
              onClick={() =>
                this.setState({ currentSegmentName: segment.name })
              }
              style={{
                borderBottom: `solid 1px ${
                  currentSegmentName === segment.name ? "lightgray" : "white"
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
                    currentSegmentName === segment.name ? "black" : "darkgray",
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

  renderSingleSegment = (
    boardContext: any,
    children: (ctx: { boardContext: any; service: any }) => React.ReactNode,
    resizable: boolean,
    onResize: ((service: any, size: any) => void) | undefined,
    _style: React.CSSProperties,
  ): React.ReactNode => {
    const { setup } = this.props;
    const c = children({
      boardContext,
      service: setup
        ? setup(boardContext, this.props)
        : this.setup(boardContext, this.props),
    });
    return resizable ? (
      <Resizable
        onResize={
          onResize ? (size: any) => onResize(this.service, size) : undefined
        }
      >
        {c as React.ReactElement}
      </Resizable>
    ) : (
      c
    );
  };

  render(): React.ReactNode {
    const {
      children,
      segments,
      setup,
      resizable = true,
      onResize = () => {},
      style = {},
    } = this.props;
    return (
      <BoardConsumer>
        {(boardContext: any) =>
          segments
            ? this.renderSegments(
                {
                  service: setup
                    ? setup(boardContext, this.props)
                    : this.setup(boardContext, this.props),
                },
                segments,
                resizable,
                onResize,
                style,
              )
            : this.renderSingleSegment(
                boardContext,
                children!,
                resizable,
                onResize,
                style,
              )
        }
      </BoardConsumer>
    );
  }
}
