import React from 'react';
import uuid from 'uuid/v4';

import Device from './components/Device';

export function createDevice(deviceId) {
  const id = uuid();
  switch(deviceId) {
    default:
      return <Device key={id} id={id} />;
  }
}
