import React from 'react';

import IngressUI from './components/services/IngressUI';
import HTMLFilterUI  from './components/services/HTMLFilterUI';
import FileExchangeUI from './components/services/FileExchangeUI';
import WebsocketConsumer from './components/services/WebsocketConsumer';
import MonitorUI from './components/services/MonitorUI';
import InputUI from './components/services/InputUI';
import FilterUI from './components/services/FilterUI';
import MySqlResourceUI from './components/services/MySqlResourceUI';
import MySqlServiceUI from './components/services/MySqlServiceUI';
import TimerUI from './components/services/TimerUI';
import WebGetUI from './components/services/WebGetUI';
import DataInjectorUI from './components/services/DataInjectorUI';
import HTMLTemplatesUI from './components/services/HTMLTemplatesUI';
import OutputUI from './components/services/OutputUI';

export function createServiceUI(board, service) {
  const id = service.uuid;
  switch(service.serviceId) {
    case 'hookup.to/service/ingress':
      return <IngressUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/html-filter':
      return <HTMLFilterUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/file-exchange':
      return <FileExchangeUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/websocket-provider':
      return <WebsocketConsumer key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/monitor':
      return <MonitorUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/input':
      return <InputUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/filter':
      return <FilterUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/resource/docker/mysql':
      return <MySqlResourceUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/mysql':
      return <MySqlServiceUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/timer':
      return <TimerUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/web-get':
      return <WebGetUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/data-injector':
      return <DataInjectorUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/html-templates':
      return <HTMLTemplatesUI key={id} id={id} service={service} board={board} />;
    case 'hookup.to/service/output':
      return <OutputUI key={id} id={id} service={service} board={board} />
    default:
      return <div key={id} id={id} service={service} style={{ minWidth: 200 }} />;
  }
}
