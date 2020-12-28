import React, { Component } from 'react';
import uuid from 'uuid';

import BoardProvider, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Runtime from '../components/Runtime';
import BrowserRuntime from '../runtime/BrowserRuntime'; 
import DragProvider from '../DragContext';
import { s, t } from '../styles';

function createRuntime(id, onResult, bundles='') {
    return BrowserRuntime.createInstance({ 
      id, 
      name: id,
      sendResult: onResult,
    },
    { bundles }
  );
}

export default class Playground extends Component {
  state = {
    runtimes: [],
    services: {},
  };

  addService = (descriptor, runtimeId) => {
    const { runtimes, services } = this.state;
    const runtime = runtimes.find(rt => rt.id === runtimeId);
    if (runtime) {
      const uid = uuid.v4();
      const svc = runtime.createService(descriptor, uid);
      const svcs = services[runtime.id];
      this.setState({ 
        services: { 
          ...services,
          [runtime.id]: [...svcs, svc],
        }
      });
    }
  }

  addRuntime = async () => {
    const { runtimes, services } = this.state;
    const runtimeId = `playground-rt-${runtimes.length}`;
    const rt = await createRuntime(
      runtimeId,
      this.onResult.bind(this, runtimeId),
    );
    this.setState({
      runtimes: runtimes.concat(rt),
      services: {
        ...services,
        [runtimeId]: []
      }
    });
  }

  onAction = () => {
  }

  onResult = (runtimeId, svcUuid, result) => {
    const { runtimes } = this.state;
    const pos = runtimes.findIndex(rt => rt.id === runtimeId);
    if (pos !== -1) {
      const nextRuntime = runtimes[pos + 1];
      if (nextRuntime) {
        nextRuntime.processService(null, result);
      }
    }
  }

  renderRuntimes = boardContext => {
    const { runtimes, services } = this.state;
    return (
      <div style={s(t.w100)}>
        {
          runtimes.map(runtime => 
            <DragProvider
              style={{ marginBottom: 10 }}
              key={`playground-drag-provider-${runtime.id}`}
            >
              <Runtime
                key={`sandbox-playground-${runtime.id}`}
                runtime={runtime}
                boardContext={boardContext}
                services={services[runtime.id]}
              />
            </DragProvider>
          )
        }
      </div>
    );
  }

  render() {
    const boardName = 'Playground';
    const user = { 
      username: 'Anonymous',
      userId: undefined,
    };
    const availableRuntimes = [
      { name: 'browser', args: 'browser' },
    ];
    return (
      <BoardProvider
        user={user}
        boardName={boardName}
        fetchData={false}
        isRuntimeInScope={() => true}
        addService={this.addService}
      >
        <BoardConsumer>
        {
          boardContext => (
            <div style={t.fill}>
              <Toolbar
                onAddRuntime={this.addRuntime}
                onAction={this.onAction.bind(this, boardContext)}
                board={boardContext.boardName}
                availableRuntimes={availableRuntimes}
              />
              { this.renderRuntimes(boardContext) }
            </div>
          )
        }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}