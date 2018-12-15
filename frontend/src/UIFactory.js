import React from 'react';
import uuid from 'uuid/v4';

import RESTInputUI from './components/services/restInputUI';
import DOMSelectorUI  from './components/services/domSelectorUI';

export function createServiceUI(service) {
  const id = uuid();
  switch(service.serviceId) {
    case 'hookup.to/service/rest-input':
      return <RESTInputUI key={id} id={id} service={service}/>;
    case 'hookup.to/service/dom-selector':
      return <DOMSelectorUI key={id} id={id} service={service}/>;
    default:
      return <div key={id} id={id} service={service}/>;
  }
}
