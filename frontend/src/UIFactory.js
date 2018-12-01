import React from 'react';
import uuid from 'uuid/v4';

import Device from './components/Device';

export function createServiceUI(serviceId) {
  const id = uuid();
  switch(serviceId) {
    default:
      return <Device key={id} id={id} />;
  }
}
