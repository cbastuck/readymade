import React, { Component } from 'react'

import Login from './Login';
import Runtime from '../components/Runtime';
import Toolbar from '../components/Toolbar';
import { BoardConsumer } from '../BoardContext';

export default class Board extends Component {
  
  renderRuntime(boardContext, runtime) {
    return (
      <Runtime
        key={`${runtime.id}-scene`}
        runtime={runtime}
        style={{ marginBottom: 5 }}
        boardContext={boardContext}
        services={boardContext.services[runtime.name]}
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
                padding: '0px 5px',
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
