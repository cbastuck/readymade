import React, { Component } from 'react';
import { Label } from 'semantic-ui-react';

import { labelWidth, labelHeight } from './Defaults';

export default class SyncIndicator extends Component {
  render() {
    const { 
      label, 
      style,
      inSync,
      onClick,
    } = this.props;
    return (
      <Label 
        style={{
          backgroundColor: '#E8E8E8',
          borderRadius: 2,
          width: labelWidth,
          textTransform: 'uppercase',
          letterSpacing: 1,
          textAlign: 'center',
          paddingTop: 10,
          height: labelHeight,
          color: !inSync && 'red',
          cursor: !inSync ? 'pointer' : undefined,
          ...style
        }}
        onClick={ev => !inSync && onClick(ev)}
      > 
        { label } 
      </Label>
    );
}

  renderOld() {
    const { inSync, onClick } = this.props;
    return (
      <div 
        style={{ 
          width: 18,
          height: 18,
          margin: '8px 10px',
          backgroundColor: inSync ? 'green' : 'yellow',
          cursor: !inSync ? 'pointer' : undefined,
        }}
        onClick={ev => !inSync && onClick(ev)}
      />
    );
  }
}
