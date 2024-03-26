import { Component } from "react";

export default class Contact extends Component {
  render() {
    return (
      <div>
        <div
          style={{
            fontSize: "45px",
            letterSpacing: 1,
          }}
        >
          Email
        </div>
        <div
          style={{
            margin: "30px 0px",
            textTransform: "lowercase",
            fontSize: 18,
          }}
        >
          <a href="mailto:mail@hookup.to" style={{}}>
            mail@hookup.to
          </a>
        </div>
      </div>
    );
  }
}
