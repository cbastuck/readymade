import React, { Component } from 'react';
import { Tab, Menu } from 'semantic-ui-react'

import Login from './Login';
import Runtime from '../components/Runtime';
import Toolbar from '../components/Toolbar';
import { BoardConsumer } from '../BoardContext';

import { s, t } from '../styles';

export default class Board extends Component {
  renderRutimesStarTopology = (boardContext, centerId) => {
    const panes = boardContext.runtimes
      .filter(rt => rt.id !== centerId)
      .map(rt => { 
        const inScope = boardContext.isRuntimeInScope(rt);
        const menuItem = (
          <Menu.Item 
            key={`rt-star-tab-${rt.id}`} 
            style={ s(t.fs11, { color: !inScope && 'gray' }) }
            name={rt.name} 
            icon={!inScope && 'lock'}  
          />
        );
        return {
          inScope,
          menuItem, 
          render: () => <Tab.Pane>{ this.renderRuntime(boardContext, rt)} </Tab.Pane> 
        }
      });
    panes.sort((a, b) => b.inScope - a.inScope);
    const center = boardContext.runtimes.find(rt => rt.id === centerId);
    return (
      <div>
        <Tab panes={panes} />
        <div 
          style={{ margin: 15 }}
        >
          { center && this.renderRuntime(boardContext, center) }
        </div>
      </div>
    );
  }
  
  renderRuntimes = boardContext => {
    const { board={} } = boardContext;
    const { type, centerId } = board.topology || {};
    if (type === 'star') {
      return this.renderRutimesStarTopology(boardContext, centerId);
    } 
    return boardContext.runtimes.map(runtime => this.renderRuntime(boardContext, runtime));
  }
  
  renderRuntime = (boardContext, runtime) => {
    return (
      <Runtime
        key={`${runtime.id}-scene`}
        runtime={runtime}
        style={{ marginBottom: 5 }}
        boardContext={boardContext}
        services={boardContext.services[runtime.id]}
      />
    );
  }

  render() {
    const { appContext } = this.props;
    return (
      <BoardConsumer>
        {
          boardContext => (
            <div
              style={{
                height: '100%',
                width: '100%',
              }}
            >
              <Toolbar
                onAddService={boardContext.addService}
                onAddRuntime={boardContext.addRuntime}
                onAction={boardContext.onAction}
                board={boardContext.boardName}
                savedBoards={boardContext.savedBoards}
                registry={boardContext.registry}
              />
              {
                !appContext.token && (
                  <Login 
                    board={boardContext.boardName}
                  />
                )
              }
              {
                appContext.token &&
                boardContext && 
                boardContext.runtimes && 
                this.renderRuntimes(boardContext)
              }
            </div>
          )
        }
      </BoardConsumer>
    );
  }
}
