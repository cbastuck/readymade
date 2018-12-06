import React from 'react';
import uuid from 'uuid/v4';

import RESTInputUI from './components/services/restInputUI';
export function createServiceUI(service) {
  const id = uuid();
  switch(service.serviceId) {
    case 'hookup.to/service/rest-input':
      return <RESTInputUI key={id} id={id} service={service}/>;
    default:
    return <div>sdd</div>;
      //return <Device key={id} id={id} />;
  }
}
