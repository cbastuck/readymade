import React from 'react';

/*
import IngressUI from './components/services/IngressUI';
import HTMLFilterUI  from './components/services/HTMLFilterUI';
import FileExchangeUI from './components/services/FileExchangeUI';
import WebsocketConsumer from './components/services/WebsocketConsumer';
import InputUI from './components/services/InputUI';
import FilterUI from './components/services/FilterUI';
import MySqlResourceUI from './components/services/MySqlResourceUI';
import MySqlServiceUI from './components/services/MySqlServiceUI';
import TimerUI from './components/services/TimerUI';
import WebGetUI from './components/services/WebGetUI';
import DataInjectorUI from './components/services/DataInjectorUI';
import HTMLTemplatesUI from './components/services/HTMLTemplatesUI';
import FileS3UI from './components/services/FileS3UI';
import AggregatorUI from './components/services/AggregatorUI';
*/

import OutputUI from './components/services/OutputUI';
import defaultRegistry from './runtime/registry/Default';

function findServiceUi(registry, serviceId) {
  const a = registry || defaultRegistry;
  return a.find(s => serviceId === s.serviceId && s.createUI);
}

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

export function createServiceUI(registry, board, service, runtimeId, userId=undefined) {
  const serviceId = service.serviceId || service.__descriptor.serviceId;
  switch(serviceId) {
    case 'hookup.to/service/output': {
      const params = { key: serviceId, id: serviceId, service, board, userId };
      return <OutputUI { ...params } />;
    }
    /*
    case 'hookup.to/service/monitor':
      return <MonitorUI { ...params } />;
    case 'hookup.to/service/ingress':
      return <IngressUI { ...params } />;
    case 'hookup.to/service/html-filter':
      return <HTMLFilterUI { ...params } />;
    case 'hookup.to/service/file-exchange':
      return <FileExchangeUI { ...params } />;
    case 'hookup.to/service/websocket-provider':
      return <WebsocketConsumer { ...params } />;    
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
    case 'hookup.to/resource/file-s3':
      return <FileS3UI { ...params } />;
    case 'hookup.to/service/aggregator':
      return <AggregatorUI { ...params } />
      */
    default:
      break;
  }

  const factory = findServiceUi(registry, serviceId);
  if (factory) {
    const props = {
      service, 
      board, 
      runtimeId, 
      key: `key-${service.uuid}`,
    };
    return React.createElement(
      factory.createUI, 
      props,
    );
  } else {
    return createPlaceholderUI(service);
  }
}
