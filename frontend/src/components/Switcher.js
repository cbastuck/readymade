import React, { Component } from "react";

export default class Switcher extends Component {
  state = {
    counter: 0,
  };

  componentDidMount() {
    this.interval = setInterval(() => {
      this.setState({ counter: this.state.counter + 1 });
    }, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    const { data } = this.props;
    const idx = this.state.counter % data.length;
    return (
      <div
        style={{
          fontSize: 45,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: "bold",
          marginBottom: 50,
        }}
      >
         {data[idx]} 
      </div>
    );
  }
}
