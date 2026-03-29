import { Component } from "react";

export default class ServiceRedirect extends Component {
  render(): JSX.Element {
    const hs = Object.fromEntries(new URLSearchParams(window.location.hash));
    const qs = Object.fromEntries(new URLSearchParams(window.location.search));
    const params = { ...qs, ...hs };
    (window.opener as Window).postMessage(JSON.stringify(params));
    setTimeout(() => window.close(), 100);
    return <div> This will close ... </div>;
  }
}
