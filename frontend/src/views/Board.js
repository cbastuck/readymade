import React, { Component } from 'react'

import Login from './Login';
import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { BoardConsumer } from '../BoardContext';
import { createServiceUI } from '../UIFactory';

export default class Board extends Component {
  
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
                boardContext.runtimes.map(
                  runtime => 
                    <Scene 
                      key={`${runtime.name}-scene`}
                      runtime={runtime.name}
                      style={{
                        marginBottom: 5
                      }}
                    >
                      {
                        boardContext.services[runtime.name] && 
                        boardContext.services[runtime.name].map(svc => 
                          createServiceUI(boardContext.boardName, svc, runtime.id)
                        )
                      }
                    </Scene>
                )
              }
            </div>
          )
        }
      </BoardConsumer>
    );
  }
}
