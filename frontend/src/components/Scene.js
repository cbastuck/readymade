import React, { Component } from 'react';

import ServiceFrame from './ServiceFrame';

export default class Scene extends Component {
  state = {
    expanded: false,
    readonly: false,
  };

  componentDidMount() {
    const { readonly } = this.props;
    this.setState({
      expanded: !readonly,
      readonly: readonly
    });
  }

  componentWillReceiveProps(nextProps) {
    if (this.state.readonly !== nextProps.readonly) {
      this.setState({ 
        expanded: !nextProps.readonly,
        readonly: nextProps.readonly
      });
    }
  }

  renderExpandIcon() {
    const style = {
      width: 100,
      cursor: 'pointer'
    };
    const onClick = _ => this.setState({ expanded: !this.state.expanded })
    return this.state.expanded ? 
      <span style={style} onClick={onClick}> - </span> :
      <span style={style} onClick={onClick}> + </span>;
  }

  render() {
    const { children, runtime, wrap=false, style, readonly=false } = this.props;
    
    const readonlyStyle = readonly ? 
      {
        backgroundColor: '#FFFFFF',
        opacity: 0.3,
        width: '100%',
        zIndex: 200000,
        cursor: 'not-allowed',
        display: !this.state.expanded && 'none'
      } :
      {};

    return (
      <div
        style={{
          // height: '93%',
          border: 'solid 1px lightgray',
          borderRadius: 3,
          backgroundColor: '#EEEEEE10',
          padding: 10,
          ...style,
        }}
      >
        <h4>{this.renderExpandIcon()} {runtime}</h4>
        <div
          style={{
            display: 'flex',
            flexFlow: wrap ? 'row wrap' : 'row nowrap',
            overflow: 'auto',
          }}
        >
          <div 
            style={readonlyStyle}
            onClickCapture={e => readonly && e.stopPropagation()}
          >
          {
            this.state.expanded && children && children.map(
              service => {
                return (
                  <ServiceFrame
                    key={`scene-frame-${service.props.service.uuid}`}
                    service={service}
                  />
                )
              }
            )
          }
          </div>
        </div>
      </div>
    );
  }
}
