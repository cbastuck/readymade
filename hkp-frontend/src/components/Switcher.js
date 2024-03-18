import { Component } from "react";

const defaultStyle = {
  fontSize: 45,
  letterSpacing: 1,
  marginBottom: 50,
};

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
    const { data, style = defaultStyle } = this.props;
    const idx = this.state.counter % data.length;
    return <div style={style}>{data[idx]}</div>;
  }
}
