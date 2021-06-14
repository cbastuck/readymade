import React, { Component } from 'react';

import queryString from 'query-string';

export default class ServiceRedirect extends Component {
  render() {
    const hs = queryString.parse(window.location.hash);
    const qs = queryString.parse(window.location.search);
    const params = { ...qs, ...hs };
    window.opener.postMessage(JSON.stringify(params));
    setTimeout(() => window.close(), 100); 
    return <div> This will close ... </div>;
  }
}