import React, { Component } from 'react'

import Login from './Login';
import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { BoardConsumer } from '../BoardContext';
import { createServiceUI, createPlaceholderUI } from '../UIFactory';

export default class Board extends Component {
  
  renderRuntime(boardContext, runtime) {
    const isOwner = boardContext.isRuntimeInScope(runtime);
    const readonly = !isOwner;
    return (
      <Scene
        key={`${runtime.id}-scene`}
        runtime={runtime}
        style={{ marginBottom: 5 }}
        boardContext={boardContext}
      >
        {
          boardContext.services[runtime.name] && 
          boardContext.services[runtime.name].map(svc =>
            readonly ? 
              createPlaceholderUI(svc) :
              createServiceUI(boardContext.boardName, svc, runtime.id)
          )
        }
      </Scene>
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
                padding: 5
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
                boardContext.runtimes.map(runtime => this.renderRuntime(boardContext, runtime))
              }
            </div>
          )
        }
      </BoardConsumer>
    );
  }
}
