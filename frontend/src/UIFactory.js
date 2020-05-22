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
import FileS3UI from './components/services/FileS3UI';
import AggregatorUI from './components/services/AggregatorUI';

import BrowserRuntime from './runtime/BrowserRuntime';

export function createPlaceholderUI(service) {
  return (
    <div 
      key={service.uuid} 
      id={service.uuid} 
      service={service} 
      style={{ minWidth: 200 }} 
    />
  );
}

export function createServiceUI(board, service, runtimeId, userId=undefined) {
  const id = service.uuid;
  const params = { key: id, id: id, service, board, userId };
  switch(service.serviceId) {
    case 'hookup.to/service/ingress':
      return <IngressUI { ...params } />;
    case 'hookup.to/service/html-filter':
      return <HTMLFilterUI { ...params } />;
    case 'hookup.to/service/file-exchange':
      return <FileExchangeUI { ...params } />;
    case 'hookup.to/service/websocket-provider':
      return <WebsocketConsumer { ...params } />;
    case 'hookup.to/service/monitor':
      return <MonitorUI { ...params } />;
    case 'hookup.to/service/input':
      return <InputUI { ...params } />;
    case 'hookup.to/service/filter':
      return <FilterUI { ...params } />;
    case 'hookup.to/resource/docker/mysql':
      return <MySqlResourceUI { ...params } />;
    case 'hookup.to/service/mysql':
      return <MySqlServiceUI { ...params } />;
    case 'hookup.to/service/timer':
      return <TimerUI { ...params } />;
    case 'hookup.to/service/web-get':
      return <WebGetUI { ...params } />;
    case 'hookup.to/service/data-injector':
      return <DataInjectorUI { ...params } />;
    case 'hookup.to/service/html-templates':
      return <HTMLTemplatesUI { ...params } />;
    case 'hookup.to/service/output':
      return <OutputUI { ...params } />;
    case 'hookup.to/resource/file-s3':
      return <FileS3UI { ...params } />;
    case 'hookup.to/service/aggregator':
      return <AggregatorUI { ...params } />
    default:
      const factory = BrowserRuntime.registry().find(s => 
         service.serviceId === s.serviceId && s.createUI
      );
      if (factory) {
        return React.createElement(factory.createUI, { service, board, runtimeId, key: `key-${service.uuid}` });
      } else {
        console.log('UIFactory insert default UI for', service)
        return createPlaceholderUI(service);
      }
  }
}
