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
                onAction={boardContext.onAction}
                board={boardContext.boardName}
                savedBoards={boardContext.savedBoards}
                registry={boardContext.registry}
              />
              <Scene>
                { 
                  boardContext && boardContext.services && boardContext.services.map(serviceId => 
                    createServiceUI(boardContext.boardName, serviceId)
                  )
                }
              </Scene>
            </div>
          )
        }
      </BoardConsumer>
    );
  }
}
