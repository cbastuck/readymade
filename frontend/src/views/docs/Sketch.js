import React, { Component } from 'react';
import { Icon } from 'semantic-ui-react'

import { s, t } from '../../styles';

const flexRow = { display: 'flex', flexDirection: 'row' };
const border = { border: 'solid 1px #AAA', borderRadius: 5 };
const serviceDim = { width: '100%' };
const runtimeDim = { width: '100%' };
const text = s(t.uc, t.ls1, t.fs12);
const caption = s(t.uc, t.ls1, t.fs14, { color: '#4183c4' }, t.mb2);

export default class Sketch extends Component {
  renderConfiguration = () => (
    <div
      style={s(
        t.tc,
        { marginTop: 20 }
      )}
    >
      <Icon name="file outline" size="big" />
      <div style={s(t.fs10, t.ls0, t.mt5, { color: '#333' })}>Configuration</div>
    </div>
  )

  renderService = () => (
    <div 
      style={s(
        border, 
        serviceDim,
        t.m(10, 5), 
        t.p(10)
      )}
    >
      <div style={s(caption, t.tc)}>Service</div>
      { this.renderConfiguration() }
    </div>
  )

  renderArrow = yOffset => (
    <Icon
      style={{ margin: 5, marginTop: yOffset }}
      name="chevron right" 
      size="large"
      color="grey"
    />
  )

  renderRuntime = numServices => (
    <div style={flexRow}>
      { this.renderArrow(75) }
      <div 
        style={s(
          runtimeDim, 
          border, 
          t.mb10,
          t.p5
        )}
      >
        <div 
          style={s(
            caption,
            t.tc,
            { marginLeft: 10, marginBottom: 5, marginTop: 5 },
          )}
        >
          Runtime
        </div>
        <div style={s(flexRow, t.mb10, { overflowX: 'auto' })}>
          { this.renderService() }
          { this.renderArrow(50) }
          { this.renderService() }
          { numServices > 2 && this.renderArrow(50) }
          { numServices > 2 && this.renderService() }
        </div>
      </div>
      { this.renderArrow(75) }
    </div>
  )

  renderDots = () => (
    <div 
      style={{ 
        width: '100%', 
        textAlign: 'center',
        marginBottom: 10,
      }}
    >
      ...
    </div>
  )

  renderBoard = () => (
    <div
      style={s(
        border,
        t.m(10),
        t.p(10),
        { overflowX: 'auto' }
      )}
    >
      <div style={s(t.tc)}>
        <div style={s(t.tl, { marginLeft: 35 })}>
          <div style={caption}>Board</div>
          <div style={text}>Name: Example</div>
          <div style={text}>Topology: Chain</div>
        </div>
      </div>
      <div style={{ margin: '5px 0px' }}>
        { this.renderRuntime(3) }
        { this.renderDots() }
        { this.renderRuntime(2) }
      </div>
    </div>
  )

  render() {
    return (
      <div 
        style={{ 
          width: '95%', 
          margin: 'auto',
          marginTop: 20
        }}
      >
        { this.renderBoard() }
      </div>
    );
  }
}