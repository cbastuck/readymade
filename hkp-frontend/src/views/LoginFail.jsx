import { Component } from "react";
import { Link } from "react-router-dom";

import BoardProvider, { BoardConsumer } from "../BoardContext";
import Toolbar from "../components/Toolbar";
import Footer from "@/components/Footer";

export default class LoginFail extends Component {
  render() {
    const errorMessage =
      this.props.location &&
      this.props.location.state &&
      this.props.location.state.errorMessage;

    return (
      <BoardProvider>
        <div className="hero-image">
          <BoardConsumer>{(boardContext) => <Toolbar />}</BoardConsumer>
          <div className="hero-text">
            <h1>Login failed</h1>
            {errorMessage && <div> {/*errorMessage*/} </div>}
            <div style={{ marginTop: 15 }}>
              <Link to="/new">
                <button className="button">Try again</button>
              </Link>
            </div>
          </div>
          <Footer />
        </div>
      </BoardProvider>
    );
  }
}
