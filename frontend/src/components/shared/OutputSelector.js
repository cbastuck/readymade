import React, { Component } from 'react';

import { s, t } from '../../styles';
import SelectorField from './SelectorField';

const none = 'No routing';

export default class OutputSelector extends Component {
  state = {
    selected: 'none',
    expanded: false,
  };

  static updatePeersAction = 'update-peers';
  static flowChanged = 'flow-changed';

  componentDidUpdate(prevProps) {
    if (this.props.items !== prevProps.items) {
      const options = this.getSelectorOptions();
      if (!options[this.state.selected]) { 
        this.setState({ selected: 'none' });
      }
    }
  }

  getSelectorOptions = () => {
    const { items } = this.props;
    return items.reduce(
      (a, c) => ({ ...a, [c]: c}), 
      { 'none': none },
    );
  }
  
  renderOptions = (label, selector) => {
    return (
      <div style={s(t.p10)}>
        <h1 style={s(t.tl, t.fs11, t.pt0, t.mb5)}>
          {label}
        </h1>
        {selector}
      </div>
    );
  }

  renderPeerOptions = () => {
    const { selected } = this.state;
    const { 
      onSelect, 
      onAction,
    } = this.props;
    const peerOptions = this.getSelectorOptions();
    return this.renderOptions(
      'Route to', 
      <SelectorField
        label="Peer"
        options={peerOptions}
        value={selected}
        onChange={(ev, { value: selected }) => {
          this.setState(
            { selected },
            () => onSelect(selected === none ? null : selected)
          );
        }}
        onOpen={() => onAction({type: OutputSelector.updatePeersAction })}
      />
    );
  }

  renderFlowOptions = () => {
    const { 
      onAction,
      flow='pass'
    } = this.props;
    return this.renderOptions(
      'Flow', 
      <SelectorField
        label="Flow"
        options={{ 
          pass: 'pass', 
          stop: 'stop', 
          // stopIf: 'stop-if' 
        }}
        value={flow}
        onChange={(ev, { value: flow }) => onAction({ type: OutputSelector.flowChanged, flow })}
      />
    );
  }

  renderExpanded = () => {
    return (
      <div style={t.p3}>
        { this.renderFlowOptions() }
        { this.renderPeerOptions() }        
      </div>
    ) 
  }

  render() {
    const { expanded } = this.state;
    const { 
      onExpand,
      onCollapse,
    } = this.props;
    return (
      <div 
        style={s(
          t.uc, t.ls1, t.fs12, 
          { 
            height: '90%',
            minHeight: 140,
            minWidth: expanded && 200,
            marginTop: 10,
          },
          {   
            border: 'solid 1px lightgray',
            borderRight: 'none',
            borderRadius: 5,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          { 
            display: 'flex',
            flexDirection: 'row',
          }
        )}
      >
      <button
        style={{
          height: '100%',
          border: 'none',
          textAlign: 'center',
          backgroundColor: expanded ? 'gray' : '#efefef'
        }}
        onClick={() => { 
          this.setState(
            { expanded: !expanded }, 
            () => {
              if (expanded) {
                onCollapse && onCollapse();
              } else {
                onExpand && onExpand();
              }
            }
          );
        }}
      >
        <div
          style={
            s(
              t.uc, t.ls1, t.fs10,
              { 
                transform: 'rotate(-90deg)',
                marginTop: 35,
                width: 8,
                color: expanded ? 'white' : '#333'
              },
            )}
        >
          Output 
        </div>
      </button>
      { expanded && this.renderExpanded() }
      </div>
    );
  }
}