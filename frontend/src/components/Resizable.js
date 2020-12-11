import React, { Component } from 'react';

import { DragConsumer } from '../DragContext';

class Triangle extends Component {
  render() {
    const { 
      height=10,
      width=10
    } = this.props;
    return (
      <svg 
        height={height}
        width={width}
      >
        <polygon 
          points={`0,${height} ${width},${height} ${width},0`}
          style={{ 
            fill:'#efefef',
            stroke:'lightgray',
            strokeWidth: 1
          }} 
        />
      </svg>
    );
  }
}

export default class Resizable extends Component {
  state = {
    resizing: false,
    resizeStart: {},
    width: undefined,
    height: undefined,
    minWidth: undefined,
    minHeight: undefined,
    initialScreenX: undefined,
    initialScreenY: undefined,
  };

  getRect = () => {
    return this.root.getClientRects()[0];
  }

  onMove = ev => {
    const { 
      resizing,
      resizeStart,
      minWidth,
      minHeight,
      initialScreenX,
      initialScreenY,
    } = this.state;

    if (resizing) {
      const rect = this.getRect();
      const diffX = ev.screenX - resizeStart.x;
      const diffY = ev.screenY - resizeStart.y;
      const width = Math.max(rect.width + diffX, minWidth);
      const height = Math.max(rect.height + diffY, minHeight);
      this.setState({
        width,
        height,
        resizeStart: { 
          x: Math.max(ev.screenX, initialScreenX),
          y: Math.max(ev.screenY, initialScreenY),
        },
      })
    }
  }

  onBegin = (ev, hasInitialSize) => {
    const newState = { 
      resizing: true,
      resizeStart: { 
        x: ev.screenX,
        y: ev.screenY,
      }
    };
    if (hasInitialSize) {
      const rect = this.getRect();
      newState.minWidth = rect.width;
      newState.minHeight = rect.height;
      newState.initialScreenX = ev.screenX;
      newState.initialScreenY = ev.screenY;
    }
    this.setState(newState);    
  }

  onEnd = ev => {
    this.setState({ 
      resizing: false,
      resizeStart: {},
    });
  }

  render() {
    const { children, style={} } = this.props;
    const { width, height } = this.state;

    if (width && height) {
      style.width = width;
      style.height = height;
    }

    return (
      <DragConsumer>
        {
          dragContext => (
            <div
              style={{ position: 'relative', ...style }}
              ref={root => this.root = root}
              onMouseMove={this.onMove}
              onMouseUp={ev => {
                this.onEnd(ev);
                dragContext.clearResizable();
              }}
            >
              { children }
              <div
                style={{
                  position: 'absolute',
                  height: 15,
                  width: 12,
                  bottom: 0,
                  right: 0,
                  cursor: 'pointer'
                }}
                onMouseDown={ev => {
                  this.onBegin(ev, width === undefined);
                  dragContext.setResizable(this);
                }}
              >
                <Triangle width="12" height="12"/>
              </div>
            </div>
          )
        }
      </DragConsumer>
    )
  }
}