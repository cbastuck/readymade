import React, { Component } from 'react'

import Scene from '../components/Scene';
import Toolbar from '../components/Toolbar';
import { BoardConsumer } from '../BoardContext';
import { createServiceUI } from '../UIFactory';

export default class Board extends Component {
  
  render() {
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
                boardContext && 
                boardContext.runtimes && 
                boardContext.runtimes.map(
                  runtime => 
                    <Scene 
                      key={`${runtime}-scene`}
                      runtime={runtime}
                    >
                      {
                        boardContext.services[runtime] && boardContext.services[runtime].map(serviceId => 
                          createServiceUI(boardContext.boardName, serviceId)
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
