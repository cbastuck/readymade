import React, { Component } from 'react';

import queryString from 'query-string';

export default class ServiceRedirect extends Component {
  render() {
    const qs = queryString.parse(window.location.hash);
    window.opener.postMessage(JSON.stringify(qs));
    setTimeout(() => window.close(), 100);
    return <div> This will close ... </div>;
  }
}