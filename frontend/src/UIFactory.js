import React from 'react';

import RESTInputUI from './components/services/restInputUI';
import DOMSelectorUI  from './components/services/domSelectorUI';
import FileExchangeUI from './components/services/FileExchangeUI';
import WebsocketConsumer from './components/services/WebsocketConsumer';
import DebugUI from './components/services/DebugUI';
import EventStreamUI from './components/services/EventStreamUI';
import FilterUI from './components/services/FilterUI';
import MySqlUI from './components/services/MySqlUI';

export function createServiceUI(service) {
  const id = service.uuid;
  switch(service.serviceId) {
    case 'hookup.to/service/rest-input':
      return <RESTInputUI key={id} id={id} service={service}/>;
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
    case 'hookup.to/service/mysql':
      return <MySqlUI key={id} id={id} service={service} />;
    default:
      return <div key={id} id={id} service={service} style={{ minWidth: 200 }} />;
  }
}
