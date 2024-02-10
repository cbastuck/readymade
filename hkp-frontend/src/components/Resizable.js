import { Component } from "react";

export default class Resizable extends Component {
  render() {
    const { children, hideHandle = false } = this.props;
    const { width = "auto", height = "auto" } = this.state || {};
    return (
      <div ref={(ref) => (this.ref = ref)} style={{ width, height }}>
        {children}
        {!hideHandle && this.renderHandle()}
      </div>
    );
  }

  renderHandle = () => {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          cursor: "nwse-resize",
        }}
        onMouseDown={() => {
          this.setState({ resizing: true });
          if (
            this.initialHeight === undefined ||
            this.initialWidth === undefined
          ) {
            const rect = this.ref.getBoundingClientRect();
            this.initialWidth = rect.width;
            this.initialHeight = rect.height;
          }
          const mouseMoveHandler = (ev) => {
            if (this.state.resizing) {
              if (this.ref) {
                const rect = this.ref.getBoundingClientRect();
                const [newWidth, newHeight] = [
                  Math.max(this.initialWidth, ev.clientX - rect.x),
                  Math.max(this.initialHeight, ev.clientY - rect.y),
                ];
                if (newWidth !== this.width || newHeight !== this.height) {
                  this.width = newWidth;
                  this.height = newHeight;

                  const newSize = { width: newWidth, height: newHeight };
                  this.setState(newSize);
                  this.props.onResize(newSize);
                }
              }
            }
          };
          const mouseUpHandler = () => {
            this.setState({ resizing: false });
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("mousemove", mouseMoveHandler);
          };
          document.addEventListener("mouseup", mouseUpHandler);
          document.addEventListener("mousemove", mouseMoveHandler);
        }}
      >
        <svg viewBox="0 0 10 10">
          <polygon
            points="0,10, 10,0, 10,10"
            style={{
              fill: "#9f9f9f",
              stroke: "transparent",
              strokeWidth: "1",
            }}
          />
        </svg>
      </div>
    );
  };
}
