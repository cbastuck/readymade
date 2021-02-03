import React, { Component } from 'react';

import { DragConsumer } from '../DragContext';
import { s, t } from '../styles';

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

  componentDidMount() {
    setTimeout(() => {
      const rect = this.getRect();
      if (rect) {
        this.setState({ 
          minWidth: rect.width,
          minHeight: rect.height
        })
      }
    }, 500); 
  }

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

  render_customResize() {
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
                ev.stopPropagation();
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
                  ev.stopPropagation();
                }}
              >
                <Triangle width="12" height="12" />
              </div>
            </div>
          )
        }
      </DragConsumer>
    )
  }

    render() {
      const { children, style={} } = this.props;
      const { 
        minWidth,
        minHeight,
      } = this.state;
      return (
        <div
          ref={root => this.root = root}
          style={
            s({ 
                position: 'relative',
                minWidth: minWidth,
                minHeight: minHeight,
                ...style 
              },
              t.resizable
            )
          }
        >
          { children }
          <div
            style={{
              position: 'absolute',
              height: 15,
              width: 12,
              bottom: 0,
              right: 0,
              // cursor: 'pointer'
            }}
          >
            <Triangle width="12" height="12" /> 
          </div>
        </div>
      );
  }
}