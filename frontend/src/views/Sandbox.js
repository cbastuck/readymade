import React, { Component } from 'react';

export default class Sandbox extends Component {
  render() {
    const { 
      title, 
      src,
      onAction,
      maxWidth,
      frameless='false', 
      frameBorder='0',
      height='100%',
      width='100%',
    } = this.props;
    const style = {
      height,
      width
    };
    if (maxWidth) {
      style.maxWidth = maxWidth;
    }
    return (
       <iframe 
          title={title}
          src={`/sandbox?src=${src}&frameless=${frameless}`} 
          frameBorder={frameBorder}
          style={style}
          ref={frame => {
            if (frame && onAction) {
              frame.onAction = onAction;
            }
          }}
        />
    );
  }
}