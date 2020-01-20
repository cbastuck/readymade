import React, { Component } from 'react';

export default class Sandbox extends Component {
  render() {
    const { 
      title, 
      src,
      onAction,
      frameless='false', 
      frameBorder='0',
      height='100%',
      width='100%',
    } = this.props;
    return (
       <iframe 
          title={title}
          src={`/sandbox?src=${src}&frameless=${frameless}`} 
          frameBorder={frameBorder}
          style={{
            height,
            width
          }}
          ref={frame => {
            if (frame && onAction) {
              frame.onAction = onAction;
            }
          }}
        />
    );
  }
}