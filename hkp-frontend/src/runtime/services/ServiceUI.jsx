import { Component } from "react";

import { BoardConsumer } from "../../BoardContext";
import Resizable from "../../components/Resizable";

function getNotificationID(service) {
  return `service-ui-${service.uuid}`;
}

/*
 * THIS IS DEPRECATED
 */
export default class ServiceUI extends Component {
  state = {
    currentSegmentName: undefined,
  };

  constructor(props) {
    super(props);
    const { service, initialSegment } = props;
    if (initialSegment) {
      this.state.currentSegmentName = initialSegment(service);
    }
  }

  componentWillUnmount() {
    this.cleanupNotificationTarget();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  cleanupNotificationTarget = () => {
    const { service } = this.props;
    if (service && service.app && this.onNotification) {
      service.app.unregisterNotificationTarget?.(service, this.onNotification);
      this.onNotification = null;
    }
  };

  setup = (
    boardContext,
    { runtimeId, service: backendService, onTimer, onInit, onNotification }
  ) => {
    const { service } = this.props;
    if (!this.service) {
      if (service) {
        this.service = service;
        if (onInit) {
          setTimeout(() => onInit(service), 0);
        }
        if (onTimer) {
          this.timer = setInterval(() => onTimer(service), 1000);
        }
        if (onNotification) {
          this.cleanupNotificationTarget();
          service.app.registerNotificationTarget?.(service, onNotification);
          this.onNotification = onNotification;
        }
      }
    }
    return this.service;
  };

  getCurrentSegmentName = () => {
    const { segments } = this.props;
    const { currentSegmentName } = this.state;
    if (currentSegmentName) {
      return currentSegmentName;
    }

    for (const segment of segments) {
      if (segment && !segment.disabled) {
        return segment.name;
      }
    }
  };

  renderSegments = ({ service }, segments, resizable, onResize, style) => {
    if (!service) {
      return false;
    }
    const currentSegmentName = this.getCurrentSegmentName();
    const segment = segments.find(
      (segment) => segment.name === currentSegmentName
    );
    return (
      <Resizable
        hideHandle={!resizable}
        onResize={onResize ? (size) => onResize(this.service, size) : undefined}
        style={{ minWidth: 350, ...style }}
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

  renderSegmentsHeader = (segments, currentSegmentName) => {
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
              disabled={segment.disabled}
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
    boardContext,
    children,
    resizable,
    onResize,
    style
  ) => {
    const { setup } = this.props;
    const c = children({
      boardContext,
      service: setup
        ? setup(boardContext, this.props)
        : this.setup(boardContext, this.props),
    });
    return resizable ? (
      <Resizable
        onResize={onResize ? (size) => onResize(this.service, size) : undefined}
        style={{ minWidth: 350, ...style }}
      >
        {c}
      </Resizable>
    ) : (
      c
    );
  };

  render() {
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
        {(boardContext) =>
          segments
            ? this.renderSegments(
                {
                  boardContext,
                  service: setup
                    ? setup(boardContext, this.props)
                    : this.setup(boardContext, this.props),
                },
                segments,
                resizable,
                onResize,
                style
              )
            : this.renderSingleSegment(
                boardContext,
                children,
                resizable,
                onResize,
                style
              )
        }
      </BoardConsumer>
    );
  }
}

class Notifications {
  constructor() {
    this.callbacks = {};
  }

  register(id, callback) {
    this.callbacks[id] = callback;
  }

  unregister(id) {
    delete this.callbacks[id];
  }

  notify(service, notification) {
    for (const id in this.callbacks) {
      const cb = this.callbacks[id];
      cb(service, notification);
    }
  }
}
