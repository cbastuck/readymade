import React from 'react';

import EndpointUI from './components/services/EndpointUI';
import DOMSelectorUI  from './components/services/domSelectorUI';
import FileExchangeUI from './components/services/FileExchangeUI';
import WebsocketConsumer from './components/services/WebsocketConsumer';
import DebugUI from './components/services/DebugUI';
import EventStreamUI from './components/services/EventStreamUI';
import FilterUI from './components/services/FilterUI';
import MySqlResourceUI from './components/services/MySqlResourceUI';
import MySqlServiceUI from './components/services/MySqlServiceUI';

export function createServiceUI(service) {
  const id = service.uuid;
  switch(service.serviceId) {
    case 'hookup.to/service/endpoint':
      return <EndpointUI key={id} id={id} service={service}/>;
    case 'hookup.to/service/dom-selector':
      return <DOMSelectorUI key={id} id={id} service={service}/>;
    case 'hookup.to/service/file-exchange':
      return <FileExchangeUI key={id} id={id} service={service}/>;
    case 'hookup.to/service/websocket-provider':
      return <WebsocketConsumer key={id} id={id} service={service} />;
    case 'hookup.to/service/debug':
      return <DebugUI key={id} id={id} service={service} />;
    case 'hookup.to/service/event-stream':
      return <EventStreamUI key={id} id={id} service={service} />;
    case 'hookup.to/service/filter':
      return <FilterUI key={id} id={id} service={service} />;
    case 'hookup.to/resource/docker/mysql':
      return <MySqlResourceUI key={id} id={id} service={service} />;
    case 'hookup.to/service/mysql':
      return <MySqlServiceUI key={id} id={id} service={service} />;
    default:
      return <div key={id} id={id} service={service} style={{ minWidth: 200 }} />;
  }
}
