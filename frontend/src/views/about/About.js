import React, { Component } from 'react'
import { Link } from 'react-router-dom';

import './About.css';

import cb from './cb.png'
import jcb from './jcb.png'
import sn from './sn.png'

class Profile extends Component {
  render() {
    return (
      <div>
        <h3>{this.props.name}</h3>
        <img 
          alt="none"
          src={this.props.avatar} 
          width="150"
          height="150"
        />
        <p>
          {this.props.title}
        </p>
        <div>
          {this.props.description}
        </div>
      </div>
    );
  }
}

export default class Board extends Component {

  render() {
    return (
      <div className="about-image container">
        <div className="about-text">
          <h1>About us</h1>
          
          <div className="ui relaxed grid">
            <div class="three column row">
              <div className="column">
              <Profile 
                  avatar={cb}
                  name="Bastuck"
                  title="CTO"
                  description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
                />
              </div>
              <div className="column">
                <Profile 
                  avatar={jcb}
                  name="Bombeck"
                  title="CEO"
                  description="Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."
                />
              </div>
              <div className="column">
              <Profile 
                  avatar={sn}
                  name="Nicklbeck"
                  title="COO"
                  description="Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                />
              </div>
            </div>
          </div>
          <p className="about-mission">
            Our Mission: Enable people not computers
          </p>
          <Link to="/new">
            <button>Start making</button>
          </Link>
        </div>
      </div>
    );
  }
}